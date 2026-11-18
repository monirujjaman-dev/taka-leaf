using System.Globalization;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Caching;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Savings;

/// <summary>
/// GET /api/savings - every saving and policy with where it stands, the totals, what is coming up
/// and this tax year's figures. GET /api/savings/{id} - one, with its schedule and transactions.
/// GET /api/savings/tax-year.csv?from=2026 - the tax year's savings rows, for a tax return.
/// </summary>
public static class GetSavings
{
    public const int ComingUpMax = 8;

    public static RouteGroupBuilder MapGetSavings(this RouteGroupBuilder group)
    {
        group.MapGet("/", List).WithName("GetSavings");
        group.MapGet("/tax-year.csv", TaxYearCsv).WithName("ExportSavingsTaxYear");
        group.MapGet("/{id:guid}", Detail).WithName("GetSaving");
        return group;
    }

    private static async Task<IResult> List(
        ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, UserDataCache cache, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var list = await cache.GetOrCreateAsync(userId, $"savings:{calendar.Today():yyyy-MM-dd}", ct => LoadAsync(db, calendar, userId, ct), cancellationToken);
        return Results.Ok(list);
    }

    private static async ValueTask<SavingListDto> LoadAsync(AppDbContext db, LocalCalendar calendar, Guid userId, CancellationToken cancellationToken)
    {
        var savings = await db.Savings.Where(s => s.UserId == userId).ToListAsync(cancellationToken);
        var states = await SavingRules.StatesAsync(db, calendar, userId, savings, cancellationToken);
        var names = await db.Wallets.IgnoreQueryFilters().Where(w => w.UserId == userId).ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
        var dtos = savings
            .Select(s => SavingRules.ToDto(s, states[s.Id], names.GetValueOrDefault(s.PayFromWalletId)))
            .OrderBy(s => s.Closed)
            .ThenBy(s => s.Kind == SavingKind.Insurance)
            .ThenBy(s => s.Next?.Date ?? DateOnly.MaxValue)
            .ThenBy(s => s.Name)
            .ToList();
        var open = dtos.Where(s => !s.Closed).ToList();
        var comingUp = open.Where(s => s.Next is not null).Select(ComingUp).OrderBy(c => c.Date).ThenBy(c => c.Name).Take(ComingUpMax).ToList();
        var maturing = open.Where(s => s.Kind is SavingKind.Fdr or SavingKind.Dps or SavingKind.Certificate && s.MaturesOn is not null).MinBy(s => s.MaturesOn);
        var summary = new SavingsSummary(
            open.Where(s => s.Kind != SavingKind.Insurance).Sum(s => s.Balance),
            open.Where(s => s.Kind is SavingKind.Fdr or SavingKind.Dps).Sum(s => s.Balance),
            open.Where(s => s.Kind == SavingKind.Certificate).Sum(s => s.Balance),
            open.Where(s => s.Kind == SavingKind.PrizeBond).Sum(s => s.Balance),
            open.Where(s => s.Kind == SavingKind.Insurance).Sum(s => s.Cover ?? 0),
            open.Count(s => s.Kind == SavingKind.Insurance),
            await TaxYearAsync(db, calendar, userId, SavingMath.TaxYearStart(calendar.Today()), cancellationToken),
            maturing?.Name,
            maturing?.MaturesOn);
        return new SavingListDto(summary, comingUp, dtos);
    }

    private static string Short(DateOnly date) => date.ToString("d MMM", CultureInfo.InvariantCulture);

    private static ComingUpDto ComingUp(SavingDto s)
    {
        var next = s.Next!;
        var detail = s.Kind switch
        {
            SavingKind.Dps when next.Action == "Close" => "Record what the bank paid",
            SavingKind.Dps => $"{(s.AutoRecord ? "Automatic from" : "From")} {s.PayFromWalletName}",
            SavingKind.Fdr when next.Label == "Renews" => $"Renews for {s.Months} months",
            SavingKind.Fdr or SavingKind.Certificate => $"After {s.TaxPoints / 100.0:0.##}% tax",
            SavingKind.PrizeBond => s.BondsInDraw == s.BondCount ? $"{s.BondCount} bonds in the draw" : $"{s.BondsInDraw} of {s.BondCount} bonds in the draw",
            SavingKind.Insurance when s.GraceEnds is { } grace => $"Grace to {Short(grace)}",
            SavingKind.Insurance => "Renews the policy",
            _ => null,
        };
        return new ComingUpDto(s.Id, s.Kind, s.Policy, s.Name, next.Date, next.Label, detail, next.Amount, next.Action, next.Overdue);
    }

    internal static async Task<TaxYearDto> TaxYearAsync(AppDbContext db, LocalCalendar calendar, Guid userId, DateOnly from, CancellationToken cancellationToken)
    {
        var to = from.AddYears(1).AddDays(-1);
        var start = calendar.StartOf(from);
        var end = calendar.StartOf(to.AddDays(1));
        var sums = await db.Transactions
            .Where(t => t.UserId == userId && t.SavingId != null && t.OccurredAt >= start && t.OccurredAt < end)
            .GroupBy(t => t.SavingPart)
            .Select(g => new { Part = g.Key, Sum = g.Sum(t => t.Amount) })
            .ToListAsync(cancellationToken);
        long Of(params SavingPart[] parts) => sums.Where(s => s.Part is { } p && parts.Contains(p)).Sum(s => s.Sum);
        return new TaxYearDto(from, to, Of(SavingPart.Deposit), Of(SavingPart.Profit, SavingPart.Prize), Of(SavingPart.Tax));
    }

    private static async Task<IResult> Detail(Guid id, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var saving = await SavingRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (saving is null)
        {
            return NotFound.Problem("Saving");
        }

        var state = (await SavingRules.StatesAsync(db, calendar, userId, [saving], cancellationToken))[saving.Id];
        var names = await db.Wallets.IgnoreQueryFilters().Where(w => w.UserId == userId).ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
        var dto = SavingRules.ToDto(saving, state, names.GetValueOrDefault(saving.PayFromWalletId));
        var rows = await db.Transactions
            .Where(t => t.UserId == userId && t.SavingId == saving.Id)
            .OrderByDescending(t => t.OccurredAt)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);
        var activity = await TransactionRules.ToDtosAsync(db, userId, rows, cancellationToken);
        return Results.Ok(new SavingDetailDto(dto, Schedule(saving, state, rows, names), activity));
    }

    private static List<SavingScheduleRowDto> Schedule(Saving s, SavingState state, List<Transaction> rows, Dictionary<Guid, string> names)
    {
        var result = new List<SavingScheduleRowDto>();
        string? From(Transaction? t) => t?.FromWalletId is { } w ? names.GetValueOrDefault(w) : t?.ToWalletId is { } to ? names.GetValueOrDefault(to) : null;
        var nextNumber = state.Next?.Number;
        switch (s.Kind)
        {
            case SavingKind.Dps:
                for (var n = 1; n <= s.Months; n++)
                {
                    var row = rows.FirstOrDefault(t => t.SavingPart == SavingPart.Deposit && t.SavingSeq == n);
                    var status = row is not null ? "Paid" : n <= s.PaidBefore ? "PaidBefore" : state.Missed.Contains(n) ? "Missed" : n == nextNumber ? "Due" : "Upcoming";
                    result.Add(new SavingScheduleRowDto(n, SavingRules.DueOf(s, n), status, row?.Amount ?? s.Amount, 0, row?.OccurredAt, From(row)));
                }

                break;
            case SavingKind.Fdr:
            case SavingKind.Certificate:
            {
                var gross = SavingRules.PeriodProfit(s);
                for (var k = 1; k <= SavingRules.Periods(s); k++)
                {
                    var seq = s.SeqBase + k;
                    var row = rows.FirstOrDefault(t => t.SavingPart == SavingPart.Profit && t.SavingSeq == seq);
                    var tax = rows.Where(t => t.SavingPart == SavingPart.Tax && t.SavingSeq == seq).Sum(t => t.Amount);
                    var status = row is not null ? "Paid" : k <= s.PaidBefore ? "PaidBefore" : k == state.ProfitDone + 1 && !s.ClosedOn.HasValue ? "Due" : s.ClosedOn.HasValue ? "Missed" : "Upcoming";
                    var date = s.EveryMonths > 0 ? SavingRules.ProfitDate(s, k) : SavingRules.MaturityOf(s);
                    result.Add(new SavingScheduleRowDto(k, date, status, row?.Amount ?? gross, row is not null ? tax : SavingMath.Tax(gross, s.TaxPoints), row?.OccurredAt, From(row)));
                }

                break;
            }

            case SavingKind.Insurance:
            {
                var last = state.Total ?? state.Done + 3;
                for (var n = 1; n <= last; n++)
                {
                    var row = rows.FirstOrDefault(t => t.SavingPart == SavingPart.Premium && t.SavingSeq == n);
                    var status = row is not null ? "Paid" : n <= s.PaidBefore ? "PaidBefore" : n == nextNumber ? "Due" : "Upcoming";
                    result.Add(new SavingScheduleRowDto(n, SavingRules.DueOf(s, n), status, row?.Amount ?? s.Amount, 0, row?.OccurredAt, From(row)));
                }

                break;
            }
        }

        return result;
    }

    private static async Task<IResult> TaxYearCsv(int? from, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var first = from is { } year && year is > 1999 and < 2200 ? new DateOnly(year, 7, 1) : SavingMath.TaxYearStart(calendar.Today());
        var start = calendar.StartOf(first);
        var end = calendar.StartOf(first.AddYears(1));
        var savings = await db.Savings.IgnoreQueryFilters().Where(s => s.UserId == userId).ToDictionaryAsync(s => s.Id, cancellationToken);
        var names = await db.Wallets.IgnoreQueryFilters().Where(w => w.UserId == userId).ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
        var rows = await db.Transactions
            .Where(t => t.UserId == userId && t.SavingId != null && t.OccurredAt >= start && t.OccurredAt < end)
            .OrderBy(t => t.OccurredAt)
            .ToListAsync(cancellationToken);

        var csv = new StringBuilder();
        ExportTransactions.AppendRow(csv, ["Date", "Saving or policy", "Kind", "Entry", "Amount (BDT)", "Account"]);
        foreach (var t in rows)
        {
            var saving = savings.GetValueOrDefault(t.SavingId!.Value);
            var account = (t.SavingPart is SavingPart.Deposit or SavingPart.Tax or SavingPart.Fee or SavingPart.Premium ? t.FromWalletId : t.ToWalletId) is { } w
                ? names.GetValueOrDefault(w) ?? "" : "";
            ExportTransactions.AppendRow(csv,
            [
                calendar.DateOf(t.OccurredAt).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), saving?.Name ?? "", saving?.Kind.ToString() ?? "",
                t.SavingPart?.ToString() ?? "", ExportTransactions.Taka(t.Amount), account,
            ]);
        }

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        return Results.File(bytes, "text/csv; charset=utf-8", $"takaleaf-tax-year-{first.Year}-{(first.Year + 1) % 100:00}.csv");
    }
}
