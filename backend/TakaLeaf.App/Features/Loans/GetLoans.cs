using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Caching;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Loans;

/// <summary>
/// GET /api/loans - every loan with where it stands, the totals left to pay and the EMIs due in
/// the next 30 days. GET /api/loans/{id} - one loan with its schedule, its transactions and, for a
/// card EMI, how the card's limit is shared.
/// </summary>
public static class GetLoans
{
    public const int UpcomingDays = 30;

    public static RouteGroupBuilder MapGetLoans(this RouteGroupBuilder group)
    {
        group.MapGet("/", List).WithName("GetBankLoans");
        group.MapGet("/{id:guid}", Detail).WithName("GetBankLoan");
        return group;
    }

    private static async Task<IResult> List(
        ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, UserDataCache cache, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var list = await cache.GetOrCreateAsync(userId, $"loans:{calendar.Today():yyyy-MM-dd}", ct => LoadAsync(db, calendar, userId, ct), cancellationToken);
        return Results.Ok(list);
    }

    private static async ValueTask<LoanListDto> LoadAsync(AppDbContext db, LocalCalendar calendar, Guid userId, CancellationToken cancellationToken)
    {
        var loans = await db.Loans.Where(l => l.UserId == userId).ToListAsync(cancellationToken);
        var states = await LoanRules.StatesAsync(db, userId, loans, cancellationToken);
        var names = await WalletNamesAsync(db, userId, cancellationToken);
        var today = calendar.Today();
        var dtos = loans
            .Select(l => LoanRules.ToDto(l, states[l.Id], names.GetValueOrDefault(l.PayFromWalletId), today))
            .OrderBy(l => l.Closed)
            .ThenBy(l => l.Next?.DueDate ?? DateOnly.MaxValue)
            .ThenBy(l => l.Name)
            .ToList();
        var open = dtos.Where(l => !l.Closed).ToList();
        var upcoming = open
            .Where(l => l.Next is { } next && next.DueDate <= today.AddDays(UpcomingDays))
            .Select(l => new DueEmiDto(l.Id, l.Name, l.Type, l.Next!.Number, l.Next.DueDate, l.Next.Total, l.PayFromWalletName, l.Next.Overdue))
            .OrderBy(d => d.DueDate)
            .ToList();
        var summary = new LoansSummary(
            open.Sum(l => l.Outstanding),
            open.Where(l => l.Type == LoanType.Bank).Sum(l => l.Outstanding),
            open.Where(l => l.Type == LoanType.CardEmi).Sum(l => l.Outstanding),
            upcoming);
        return new LoanListDto(summary, dtos);
    }

    private static async Task<IResult> Detail(
        Guid id, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await LoanRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (loan is null)
        {
            return NotFound.Problem("Loan");
        }

        var state = (await LoanRules.StatesAsync(db, userId, [loan], cancellationToken))[loan.Id];
        var names = await WalletNamesAsync(db, userId, cancellationToken);
        var today = calendar.Today();
        var dto = LoanRules.ToDto(loan, state, names.GetValueOrDefault(loan.PayFromWalletId), today);

        var rows = await db.Transactions
            .Where(t => t.UserId == userId && t.LoanId == loan.Id)
            .OrderByDescending(t => t.OccurredAt)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        var schedule = new List<ScheduleRowDto>();
        var before = LoanMath.Schedule(loan.Principal, loan.RatePoints, loan.Emi, 1, loan.PaidBefore);
        schedule.AddRange(before.Select(r => new ScheduleRowDto(
            r.Number, LoanRules.DueDateOf(loan, r.Number), "PaidBefore", r.Principal, r.Interest, r.Total, r.BalanceAfter, null, null)));
        foreach (var paid in rows.Where(t => t.LoanEmi != null).GroupBy(t => t.LoanEmi!.Value).OrderBy(g => g.Key))
        {
            var principalRow = paid.FirstOrDefault(t => t.LoanPart == LoanPart.Principal);
            var repaid = principalRow?.Amount ?? 0;
            var interest = paid.Where(t => t.LoanPart == LoanPart.Interest).Sum(t => t.Amount);
            schedule.Add(new ScheduleRowDto(
                paid.Key, LoanRules.DueDateOf(loan, paid.Key), "Paid", repaid, interest, repaid + interest, null,
                principalRow?.OccurredAt, principalRow?.FromWalletId is { } from ? names.GetValueOrDefault(from) : null));
        }

        schedule.AddRange(state.Rest.Select((r, i) => new ScheduleRowDto(
            r.Number, LoanRules.DueDateOf(loan, r.Number), i == 0 ? "Due" : "Upcoming", r.Principal, r.Interest, r.Total, r.BalanceAfter, null, null)));

        CardLimitDto? card = null;
        if (loan.Type == LoanType.CardEmi)
        {
            card = await CardLimitAsync(db, userId, loan.PayFromWalletId, cancellationToken);
        }

        var activity = await TransactionRules.ToDtosAsync(db, userId, rows, cancellationToken);
        return Results.Ok(new LoanDetailDto(dto, schedule.OrderByDescending(r => r.Number).ToList(), activity, card));
    }

    /// <summary>A card's limit split into what was spent, what its EMIs still have to bill, and what is left.</summary>
    internal static async Task<CardLimitDto?> CardLimitAsync(AppDbContext db, Guid userId, Guid cardId, CancellationToken cancellationToken)
    {
        var card = await db.Wallets.IgnoreQueryFilters().FirstOrDefaultAsync(w => w.Id == cardId && w.UserId == userId, cancellationToken);
        if (card is null)
        {
            return null;
        }

        var movements = await Balances.MovementsAsync(db, userId, cancellationToken);
        var held = (await HeldByCardAsync(db, userId, movements, cancellationToken)).GetValueOrDefault(card.Id);
        var balance = card.OpeningBalance + movements.GetValueOrDefault(card.Id);
        var spent = Math.Max(-balance, 0);
        long? available = card.CreditLimit is { } limit ? limit - spent - held : null;
        return new CardLimitDto(card.Id, card.Name, card.CreditLimit, spent, held, available);
    }

    /// <summary>Per credit card: what its open card EMIs have still to bill, which the bank holds from the limit.</summary>
    internal static async Task<Dictionary<Guid, long>> HeldByCardAsync(
        AppDbContext db, Guid userId, IReadOnlyDictionary<Guid, long> movements, CancellationToken cancellationToken)
    {
        var emis = await db.Loans
            .Where(l => l.UserId == userId && l.Type == LoanType.CardEmi && l.ClosedOn == null)
            .Join(db.Wallets, l => l.WalletId, w => w.Id, (l, w) => new { l.PayFromWalletId, w.Id, w.OpeningBalance })
            .ToListAsync(cancellationToken);
        return emis
            .GroupBy(e => e.PayFromWalletId)
            .ToDictionary(g => g.Key, g => g.Sum(e => Math.Max(-(e.OpeningBalance + movements.GetValueOrDefault(e.Id)), 0)));
    }

    private static Task<Dictionary<Guid, string>> WalletNamesAsync(AppDbContext db, Guid userId, CancellationToken cancellationToken) =>
        db.Wallets.IgnoreQueryFilters().Where(w => w.UserId == userId).ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
}
