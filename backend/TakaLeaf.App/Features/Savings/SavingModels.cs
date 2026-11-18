using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Savings;

/// <summary>
/// What happens next to a saving or policy. Action: Auto (recorded on the day), Record (the user
/// records it), Pay (a premium), Close (matured: record what was paid out) or Draw (a prize bond draw).
/// </summary>
public sealed record SavingNextDto(int? Number, DateOnly Date, string Label, long? Amount, string Action, bool Overdue);

/// <summary>A saving or policy as the API returns it. Amounts in poisha.</summary>
public sealed record SavingDto(
    Guid Id,
    SavingKind Kind,
    string Name,
    string? Provider,
    Guid? WalletId,
    Guid PayFromWalletId,
    string? PayFromWalletName,
    long Amount,
    int RatePoints,
    int Months,
    int EveryMonths,
    DateOnly StartDate,
    int TaxPoints,
    long ChargesPerYear,
    long? MaturityAmount,
    long? Cover,
    PolicyType? Policy,
    string? PolicyNumber,
    string? Insured,
    string? Nominee,
    IReadOnlyList<string> BondNumbers,
    int PaidBefore,
    bool AutoRecord,
    bool Remind,
    bool Renew,
    IReadOnlyList<int> Missed,
    DateOnly? ClosedOn,
    long Balance,
    bool Closed,
    DateOnly? MaturesOn,
    int Done,
    int? Total,
    SavingNextDto? Next,
    long ProfitReceived,
    long TaxTaken,
    long PaidSoFar,
    long? Estimate,
    int DaysDone,
    int DaysTotal,
    int BondCount,
    int BondsInDraw,
    DateOnly? NextDraw,
    DateOnly? GraceEnds);

/// <summary>One entry of "Coming up": the next thing for a saving or policy.</summary>
public sealed record ComingUpDto(Guid SavingId, SavingKind Kind, PolicyType? Policy, string Name, DateOnly Date, string Label, string? Detail, long? Amount, string Action, bool Overdue);

/// <summary>The tax year (July to June): money put into savings, profit and prizes before tax, and tax taken at source.</summary>
public sealed record TaxYearDto(DateOnly From, DateOnly To, long Invested, long Profit, long Tax);

public sealed record SavingsSummary(long Saved, long Deposits, long Certificates, long PrizeBonds, long Cover, int Policies, TaxYearDto TaxYear, string? NextToMature, DateOnly? NextToMatureOn);

public sealed record SavingListDto(SavingsSummary Summary, IReadOnlyList<ComingUpDto> ComingUp, IReadOnlyList<SavingDto> Savings);

/// <param name="Status">Paid, PaidBefore, Missed, Due or Upcoming.</param>
public sealed record SavingScheduleRowDto(int Number, DateOnly Date, string Status, long Amount, long Tax, DateTimeOffset? PaidAt, string? PaidFrom);

public sealed record SavingDetailDto(SavingDto Saving, IReadOnlyList<SavingScheduleRowDto> Schedule, IReadOnlyList<TransactionDto> Activity);

/// <summary>
/// Adding a saving or policy. AlreadyHeld: it was opened before, so it starts from today's
/// amount and no money moves now; otherwise the money comes from FromWalletId (DPS instalments and
/// premiums are recorded as they fall due). PaidBefore: DPS instalments, certificate profit
/// payments or premiums already paid. Bonds: BondCount ৳100 bonds.
/// </summary>
public sealed record AddSavingRequest(
    SavingKind? Kind,
    string? Name,
    string? Provider,
    Guid? PayFromWalletId,
    Guid? FromWalletId,
    bool? AlreadyHeld,
    long? Amount,
    int? BondCount,
    int? RatePoints,
    int? Months,
    int? EveryMonths,
    DateOnly? StartDate,
    int? TaxPoints,
    long? ChargesPerYear,
    long? MaturityAmount,
    long? Cover,
    PolicyType? Policy,
    string? PolicyNumber,
    string? Insured,
    string? Nominee,
    IReadOnlyList<string>? BondNumbers,
    int? PaidBefore,
    bool? AutoRecord,
    bool? Remind,
    bool? Renew);

/// <summary>Changing a saving. A new rate or tax applies from the next payment; Amount changes a DPS instalment or a premium.</summary>
public sealed record UpdateSavingRequest(
    string? Name,
    string? Provider,
    Guid? PayFromWalletId,
    long? Amount,
    int? RatePoints,
    int? TaxPoints,
    long? ChargesPerYear,
    long? MaturityAmount,
    long? Cover,
    PolicyType? Policy,
    string? PolicyNumber,
    string? Insured,
    string? Nominee,
    IReadOnlyList<string>? BondNumbers,
    bool? AutoRecord,
    bool? Remind,
    bool? Renew);

/// <summary>A DPS instalment (the next one), or bonds bought (BondCount, with their numbers).</summary>
public sealed record DepositRequest(Guid? WalletId, int? BondCount, IReadOnlyList<string>? BondNumbers, DateTimeOffset? OccurredAt);

/// <summary>A profit payment before maturity. Profit is before tax; both default to the expected amounts.</summary>
public sealed record ProfitRequest(Guid? WalletId, long? Profit, long? Tax, DateTimeOffset? OccurredAt);

/// <summary>
/// Closing at maturity or early. Received: all that reached the account (default at maturity: what
/// it was expected to pay); Tax: tax taken at source; Charges: excise duty or other charges taken.
/// </summary>
public sealed record CloseSavingRequest(Guid? WalletId, long? Received, long? Tax, long? Charges, DateTimeOffset? OccurredAt);

/// <summary>An FDR's new term at maturity; RatePoints: the bank's new rate, if it changed.</summary>
public sealed record RenewRequest(int? RatePoints, DateTimeOffset? OccurredAt);

/// <summary>A prize bond prize: the prize before tax, the tax rate (default the saving's), and the winning bond.</summary>
public sealed record PrizeRequest(Guid? WalletId, long? Prize, int? TaxPoints, string? Bond, DateTimeOffset? OccurredAt);

public sealed record SellBondsRequest(Guid? WalletId, int? BondCount, DateTimeOffset? OccurredAt);

public sealed record PremiumRequest(Guid? WalletId, long? Amount, DateTimeOffset? OccurredAt);

/// <param name="Kind">Claim or Maturity; Maturity closes the policy.</param>
public sealed record PayoutRequest(Guid? WalletId, long? Amount, string? Kind, DateTimeOffset? OccurredAt);

/// <summary>Where a saving stands now, from its wallet balance and its recorded rows.</summary>
internal sealed record SavingState(
    long Balance,
    int Done,
    int? Total,
    SavingNextDto? Next,
    DateOnly? MaturesOn,
    long ProfitReceived,
    long TaxTaken,
    long PaidSoFar,
    long? Estimate,
    int DaysDone,
    int DaysTotal,
    int BondCount,
    int BondsInDraw,
    DateOnly? NextDraw,
    DateOnly? GraceEnds,
    IReadOnlySet<int> Paid,
    IReadOnlyList<int> Missed,
    int ProfitDone);

/// <summary>A saving's rows, as the state needs them.</summary>
internal sealed record SavingRow(SavingPart Part, int? Seq, long Amount, DateOnly Day);

internal static class SavingRules
{
    public const int NameMax = 80;
    public const int BondNumbersMax = 8000;
    public const int MaxCatchUp = 36;
    public const string ProfitCategory = "Profit on savings";
    public const string PrizeCategory = "Prize bond prize";
    public const string PayoutCategory = "Insurance payouts";
    public const string TaxCategory = "Tax at source";
    public const string InsuranceCategory = "Insurance";
    public const string OtherIncomeCategory = "Other income";
    public const string ExciseNote = "Excise duty";
    public const string EncashNote = "Early encashment charge";
    public static readonly int[] ProfitPeriods = [0, 1, 3, 6, 12];
    public static readonly int[] PremiumPeriods = [1, 3, 6, 12];

    public static Task<Saving?> FindOwnedAsync(AppDbContext db, Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Savings.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId, cancellationToken);

    public static bool HasWallet(SavingKind kind) => kind != SavingKind.Insurance;

    public static IReadOnlyList<int> MissedOf(Saving saving) =>
        string.IsNullOrWhiteSpace(saving.Missed) ? [] : saving.Missed.Split(',').Select(s => int.TryParse(s, out var n) ? n : 0).Where(n => n > 0).Distinct().Order().ToList();

    public static IReadOnlyList<string> BondsOf(Saving saving) =>
        string.IsNullOrWhiteSpace(saving.BondNumbers) ? [] : saving.BondNumbers.Split('\n').Select(s => s.Trim()).Where(s => s.Length > 0).ToList();

    public static string? JoinBonds(IEnumerable<string>? numbers)
    {
        var list = (numbers ?? []).Select(n => Text.Clean(n)).OfType<string>().Distinct().ToList();
        return list.Count == 0 ? null : string.Join('\n', list);
    }

    /// <summary>FDR and certificate: profit payments in a term (the last is paid at maturity).</summary>
    public static int Periods(Saving s) => s.EveryMonths > 0 ? s.Months / s.EveryMonths : 1;

    /// <summary>The profit before tax of one payment: a period's, or the whole term's when paid at maturity.</summary>
    public static long PeriodProfit(Saving s) => SavingMath.Profit(s.Amount, s.RatePoints, s.EveryMonths > 0 ? s.EveryMonths : s.Months);

    public static DateOnly ProfitDate(Saving s, int k) => s.StartDate.AddMonths(k * s.EveryMonths);

    public static DateOnly MaturityOf(Saving s) => s.Kind switch
    {
        SavingKind.Dps => s.StartDate.AddMonths(Math.Max(s.Months - 1, 0)),
        _ => s.StartDate.AddMonths(s.Months),
    };

    public static DateOnly DueOf(Saving s, int number) => s.Kind == SavingKind.Insurance
        ? s.StartDate.AddMonths((number - 1) * s.EveryMonths)
        : s.StartDate.AddMonths(number - 1);

    /// <summary>What an FDR or certificate pays at maturity, principal included, after tax and charges.</summary>
    public static long MaturityNet(Saving s, long balance)
    {
        var gross = PeriodProfit(s);
        var charges = s.Kind == SavingKind.Fdr ? SavingMath.Excise(s.ChargesPerYear, s.Months) : 0;
        return balance + gross - SavingMath.Tax(gross, s.TaxPoints) - charges;
    }

    public static SavingState StateOf(Saving s, long balance, IReadOnlyList<SavingRow> rows, DateOnly today)
    {
        var profit = rows.Where(r => r.Part is SavingPart.Profit or SavingPart.Prize).Sum(r => r.Amount);
        var tax = rows.Where(r => r.Part == SavingPart.Tax).Sum(r => r.Amount);
        var closed = s.ClosedOn is not null;
        var missed = MissedOf(s);
        var paid = new HashSet<int>();
        SavingNextDto? next = null;
        int done = 0, profitDone = 0, daysDone = 0, daysTotal = 0, bondCount = 0, inDraw = 0;
        int? total = null;
        long paidSoFar = 0;
        long? estimate = null;
        DateOnly? maturesOn = null, nextDraw = null, grace = null;
        SavingNextDto Next(int? n, DateOnly date, string label, long? amount, string action) =>
            new(n, date, label, amount, action, date < today && action is "Record" or "Pay" or "Close");

        switch (s.Kind)
        {
            case SavingKind.Dps:
            {
                for (var i = 1; i <= s.PaidBefore; i++)
                {
                    paid.Add(i);
                }

                foreach (var r in rows.Where(r => r.Part == SavingPart.Deposit && r.Seq is not null))
                {
                    paid.Add(r.Seq!.Value);
                }

                done = paid.Count;
                total = s.Months;
                maturesOn = MaturityOf(s);
                paidSoFar = balance;
                estimate = s.MaturityAmount ?? SavingMath.DpsMaturity(s.Amount, s.RatePoints, Math.Max(s.Months - missed.Count, 0));
                if (!closed)
                {
                    var n = Enumerable.Range(1, s.Months).FirstOrDefault(i => !paid.Contains(i) && !missed.Contains(i));
                    next = n > 0
                        ? Next(n, DueOf(s, n), $"Instalment {n}", s.Amount, s.AutoRecord ? "Auto" : "Record")
                        : Next(null, maturesOn.Value, "Matured", estimate, "Close");
                }

                break;
            }

            case SavingKind.Fdr:
            case SavingKind.Certificate:
            {
                var periods = Periods(s);
                var maxSeq = rows.Where(r => r.Part == SavingPart.Profit && r.Seq is not null).Select(r => r.Seq!.Value).DefaultIfEmpty(0).Max();
                profitDone = Math.Max(s.PaidBefore, maxSeq - s.SeqBase);
                done = profitDone;
                total = periods;
                maturesOn = MaturityOf(s);
                daysTotal = maturesOn.Value.DayNumber - s.StartDate.DayNumber;
                daysDone = Math.Clamp(today.DayNumber - s.StartDate.DayNumber, 0, daysTotal);
                estimate = MaturityNet(s, balance);
                if (!closed)
                {
                    var auto = s.Kind == SavingKind.Fdr || s.AutoRecord;
                    if (s.EveryMonths > 0 && profitDone < periods - 1)
                    {
                        var k = profitDone + 1;
                        var gross = PeriodProfit(s);
                        next = Next(k, ProfitDate(s, k), $"Profit {k}", gross - SavingMath.Tax(gross, s.TaxPoints), auto ? "Auto" : "Record");
                    }
                    else
                    {
                        var label = s.Kind == SavingKind.Fdr && s.Renew ? "Renews" : "Matures";
                        next = Next(periods, maturesOn.Value, label, estimate, auto ? "Auto" : "Close");
                    }
                }

                break;
            }

            case SavingKind.PrizeBond:
            {
                bondCount = (int)(Math.Max(balance, 0) / SavingMath.BondValue);
                nextDraw = SavingMath.NextDraw(today);
                var cutoff = SavingMath.DrawCutoff(nextDraw.Value);
                var late = rows.Where(r => r.Part == SavingPart.Deposit && r.Day > cutoff).Sum(r => r.Amount) / SavingMath.BondValue;
                inDraw = (int)Math.Max(0, bondCount - late);
                paidSoFar = balance;
                if (!closed && bondCount > 0)
                {
                    next = Next(null, nextDraw.Value, "Prize bond draw", null, "Draw");
                }

                break;
            }

            case SavingKind.Insurance:
            {
                var maxSeq = rows.Where(r => r.Part == SavingPart.Premium && r.Seq is not null).Select(r => r.Seq!.Value).DefaultIfEmpty(0).Max();
                done = Math.Max(s.PaidBefore, maxSeq);
                total = s.Months > 0 ? s.Months / s.EveryMonths : null;
                maturesOn = s.Months > 0 ? s.StartDate.AddMonths(s.Months) : null;
                paidSoFar = s.PaidBefore * s.Amount + rows.Where(r => r.Part == SavingPart.Premium).Sum(r => r.Amount);
                if (!closed && (total is null || done < total))
                {
                    var n = done + 1;
                    var due = DueOf(s, n);
                    next = Next(n, due, $"Premium {n}", s.Amount, "Pay");
                    grace = s.Policy == PolicyType.Life ? due.AddDays(SavingMath.GraceDays) : null;
                }

                break;
            }
        }

        return new SavingState(balance, done, total, next, maturesOn, profit, tax, paidSoFar, estimate, daysDone, daysTotal, bondCount, inDraw,
            nextDraw, grace, paid, missed, profitDone);
    }

    /// <summary>Wallet balances and recorded rows for some savings of a user, in three queries.</summary>
    public static async Task<Dictionary<Guid, SavingState>> StatesAsync(
        AppDbContext db, LocalCalendar calendar, Guid userId, IReadOnlyList<Saving> savings, CancellationToken cancellationToken)
    {
        var movements = await Balances.MovementsAsync(db, userId, cancellationToken);
        var walletIds = savings.Where(s => s.WalletId is not null).Select(s => s.WalletId!.Value).ToList();
        var openings = await db.Wallets.IgnoreQueryFilters()
            .Where(w => w.UserId == userId && walletIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.OpeningBalance, cancellationToken);
        var ids = savings.Select(s => s.Id).ToList();
        var rows = (await db.Transactions
                .Where(t => t.UserId == userId && t.SavingId != null && ids.Contains(t.SavingId.Value))
                .Select(t => new { t.SavingId, t.SavingPart, t.SavingSeq, t.Amount, t.OccurredAt })
                .ToListAsync(cancellationToken))
            .Where(t => t.SavingPart is not null)
            .GroupBy(t => t.SavingId!.Value)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<SavingRow>)g.Select(t => new SavingRow(t.SavingPart!.Value, t.SavingSeq, t.Amount, calendar.DateOf(t.OccurredAt))).ToList());
        var today = calendar.Today();
        return savings.ToDictionary(s => s.Id, s =>
        {
            var balance = s.WalletId is { } w ? openings.GetValueOrDefault(w) + movements.GetValueOrDefault(w) : 0;
            return StateOf(s, balance, rows.GetValueOrDefault(s.Id) ?? [], today);
        });
    }

    public static SavingDto ToDto(Saving s, SavingState st, string? payFromName) => new(
        s.Id, s.Kind, s.Name, s.Provider, s.WalletId, s.PayFromWalletId, payFromName, s.Amount, s.RatePoints, s.Months, s.EveryMonths, s.StartDate,
        s.TaxPoints, s.ChargesPerYear, s.MaturityAmount, s.Cover, s.Policy, s.PolicyNumber, s.Insured, s.Nominee, BondsOf(s), s.PaidBefore,
        s.AutoRecord, s.Remind, s.Renew, st.Missed, s.ClosedOn, st.Balance, s.ClosedOn is not null, st.MaturesOn, st.Done, st.Total, st.Next,
        st.ProfitReceived, st.TaxTaken, st.PaidSoFar, st.Estimate, st.DaysDone, st.DaysTotal, st.BondCount, st.BondsInDraw, st.NextDraw, st.GraceEnds);

    public static async Task<SavingDto> DtoAsync(AppDbContext db, LocalCalendar calendar, Saving saving, CancellationToken cancellationToken)
    {
        var state = (await StatesAsync(db, calendar, saving.UserId, [saving], cancellationToken))[saving.Id];
        var payFrom = await db.Wallets.IgnoreQueryFilters().Where(w => w.Id == saving.PayFromWalletId).Select(w => w.Name).FirstOrDefaultAsync(cancellationToken);
        return ToDto(saving, state, payFrom);
    }

    /// <summary>One of the user's own accounts (not a person's, a loan's or a saving's), not archived unless it is the current one.</summary>
    public static async Task<IResult?> CheckAccountAsync(AppDbContext db, Guid userId, Guid? walletId, string field, Guid? current, CancellationToken cancellationToken)
    {
        if (walletId is not { } id)
        {
            return ValidationErrors.For(field, "Choose the account the money goes from or to.");
        }

        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId, cancellationToken);
        if (wallet is null)
        {
            return ValidationErrors.For(field, "That wallet does not exist.");
        }

        if (wallet.Type is WalletType.Lent or WalletType.Borrowed or WalletType.Loan or WalletType.Savings)
        {
            return ValidationErrors.For(field, "Choose one of your own wallets, like your bank account or bKash.");
        }

        return wallet.Archived && id != current ? ValidationErrors.For(field, "That wallet is archived. Unarchive it to use it.") : null;
    }

    public static Transaction Row(Saving s, SavingPart part, TransactionType type, long amount, Guid? from, Guid? to, Guid? categoryId, int? seq, DateTimeOffset at, string? note) => new()
    {
        UserId = s.UserId,
        SavingId = s.Id,
        SavingPart = part,
        SavingSeq = seq,
        Type = type,
        Amount = amount,
        FromWalletId = from,
        ToWalletId = to,
        CategoryId = categoryId,
        OccurredAt = at.ToUniversalTime(),
        Note = note,
    };

    /// <summary>
    /// The category a saving's row goes under, found by name (any level, preferring one in use) or
    /// made: Profit on savings, Prize bond prize and Insurance payouts under Other income; Tax at
    /// source on its own; premiums under Insurance (Life, Health, Car); fees under Fees and charges.
    /// </summary>
    public static async Task<Guid?> CategoryAsync(AppDbContext db, Guid userId, SavingPart part, PolicyType? policy, CancellationToken cancellationToken)
    {
        switch (part)
        {
            case SavingPart.Profit:
                return await FindOrMakeAsync(db, userId, CategoryKind.Income, ProfitCategory, OtherIncomeCategory, "percent", cancellationToken);
            case SavingPart.Prize:
                return await FindOrMakeAsync(db, userId, CategoryKind.Income, PrizeCategory, OtherIncomeCategory, "gift", cancellationToken);
            case SavingPart.Payout:
                return await FindOrMakeAsync(db, userId, CategoryKind.Income, PayoutCategory, OtherIncomeCategory, "shield", cancellationToken);
            case SavingPart.Tax:
                return await FindOrMakeAsync(db, userId, CategoryKind.Expense, TaxCategory, null, "percent", cancellationToken);
            case SavingPart.Premium:
            {
                var parent = await FindOrMakeAsync(db, userId, CategoryKind.Expense, InsuranceCategory, null, "shield", cancellationToken);
                if (policy is not { } p || p == PolicyType.Other)
                {
                    return parent;
                }

                var name = p.ToString();
                var local = db.Categories.Local.FirstOrDefault(c => c.UserId == userId && c.Kind == CategoryKind.Expense && c.Name == name && c.ParentId == parent && c.DeletedAt is null);
                var child = local?.Id ?? await db.Categories
                    .Where(c => c.UserId == userId && c.Kind == CategoryKind.Expense && c.Name == name && c.ParentId == parent)
                    .OrderBy(c => c.Archived)
                    .Select(c => (Guid?)c.Id)
                    .FirstOrDefaultAsync(cancellationToken);
                if (child is { } found)
                {
                    return found;
                }

                var made = new Category { UserId = userId, Kind = CategoryKind.Expense, Name = name, ParentId = parent, Icon = "shield", SortOrder = 99 };
                db.Categories.Add(made);
                return made.Id;
            }

            case SavingPart.Fee:
                return await db.Categories
                    .Where(c => c.UserId == userId && c.Kind == CategoryKind.Expense && c.ParentId == null && !c.Archived && c.Name == TransactionRules.FeesCategoryName)
                    .Select(c => (Guid?)c.Id)
                    .FirstOrDefaultAsync(cancellationToken);
            default:
                return null;
        }
    }

    private static async Task<Guid> FindOrMakeAsync(
        AppDbContext db, Guid userId, CategoryKind kind, string name, string? parentName, string icon, CancellationToken cancellationToken)
    {
        var local = db.Categories.Local.FirstOrDefault(c => c.UserId == userId && c.Kind == kind && c.Name == name && c.DeletedAt is null);
        if (local is not null)
        {
            return local.Id;
        }

        var existing = await db.Categories
            .Where(c => c.UserId == userId && c.Kind == kind && c.Name == name)
            .OrderBy(c => c.Archived)
            .ThenBy(c => c.ParentId != null)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is { } id)
        {
            return id;
        }

        Guid? parentId = null;
        if (parentName is not null)
        {
            parentId = await db.Categories
                .Where(c => c.UserId == userId && c.Kind == kind && c.ParentId == null && c.Name == parentName)
                .Select(c => (Guid?)c.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var category = new Category { UserId = userId, Kind = kind, Name = name, ParentId = parentId, Icon = icon, SortOrder = 99 };
        db.Categories.Add(category);
        return category.Id;
    }

    /// <summary>
    /// Pays out a saving: the money in it back to the account, the profit (what was received beyond
    /// it, before tax), the tax and charges; anything short of the money in it is a charge. Closes it.
    /// </summary>
    public static async Task AddCloseAsync(
        AppDbContext db, Saving s, long balance, Guid walletId, long received, long tax, long charges, int? seq, DateTimeOffset at, DateOnly day, CancellationToken cancellationToken)
    {
        var gross = received + tax + charges - balance;
        var shortfall = 0L;
        if (gross < 0)
        {
            shortfall = -gross;
            gross = 0;
            tax = 0;
        }

        if (balance > 0 && s.WalletId is { } own)
        {
            db.Transactions.Add(Row(s, SavingPart.Withdrawal, TransactionType.Transfer, balance, own, walletId, null, null, at, $"{s.Name} paid out"));
        }

        if (gross > 0)
        {
            db.Transactions.Add(Row(s, SavingPart.Profit, TransactionType.Income, gross, null, walletId,
                await CategoryAsync(db, s.UserId, SavingPart.Profit, null, cancellationToken), seq, at, $"{s.Name} profit"));
        }

        if (tax > 0)
        {
            db.Transactions.Add(Row(s, SavingPart.Tax, TransactionType.Expense, tax, walletId, null,
                await CategoryAsync(db, s.UserId, SavingPart.Tax, null, cancellationToken), seq, at, $"{s.Name} tax at source"));
        }

        if (charges + shortfall > 0)
        {
            db.Transactions.Add(Row(s, SavingPart.Fee, TransactionType.Expense, charges + shortfall, walletId, null,
                await CategoryAsync(db, s.UserId, SavingPart.Fee, null, cancellationToken), seq, at, shortfall > 0 ? EncashNote : ExciseNote));
        }

        s.ClosedOn = day;
    }

    /// <summary>A profit payment into an account, with its tax at source.</summary>
    public static async Task AddProfitAsync(
        AppDbContext db, Saving s, Guid? intoWalletId, long gross, long tax, int seq, DateTimeOffset at, CancellationToken cancellationToken)
    {
        // Into the account, or (an FDR renewing) into the FDR itself.
        var into = intoWalletId ?? s.WalletId;
        if (gross > 0)
        {
            db.Transactions.Add(Row(s, SavingPart.Profit, TransactionType.Income, gross, null, into,
                await CategoryAsync(db, s.UserId, SavingPart.Profit, null, cancellationToken), seq, at, $"{s.Name} profit"));
        }

        if (tax > 0)
        {
            db.Transactions.Add(Row(s, SavingPart.Tax, TransactionType.Expense, tax, into, null,
                await CategoryAsync(db, s.UserId, SavingPart.Tax, null, cancellationToken), seq, at, $"{s.Name} tax at source"));
        }
    }

    /// <summary>An FDR's maturity when it renews: the profit, tax and duty stay in it and a new term starts.</summary>
    public static async Task AddRenewAsync(AppDbContext db, Saving s, long balance, int? newRate, DateTimeOffset at, CancellationToken cancellationToken)
    {
        var periods = Periods(s);
        var gross = PeriodProfit(s);
        var tax = SavingMath.Tax(gross, s.TaxPoints);
        var excise = SavingMath.Excise(s.ChargesPerYear, s.Months);
        var seq = s.SeqBase + periods;
        if (s.EveryMonths > 0)
        {
            // The last period's profit goes to the account like the others; the sum stays.
            await AddProfitAsync(db, s, s.PayFromWalletId, gross, tax, seq, at, cancellationToken);
            gross = 0;
            tax = 0;
        }
        else
        {
            await AddProfitAsync(db, s, null, gross, tax, seq, at, cancellationToken);
        }

        if (excise > 0 && s.WalletId is { } own)
        {
            db.Transactions.Add(Row(s, SavingPart.Fee, TransactionType.Expense, excise, own, null,
                await CategoryAsync(db, s.UserId, SavingPart.Fee, null, cancellationToken), seq, at, ExciseNote));
        }

        s.StartDate = MaturityOf(s);
        s.Amount = balance + gross - tax - excise;
        s.SeqBase = seq;
        if (newRate is { } rate)
        {
            s.RatePoints = rate;
        }
    }
}
