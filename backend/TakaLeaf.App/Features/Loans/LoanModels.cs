using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Loans;

/// <summary>The next EMI to pay: its number, date and split.</summary>
public sealed record NextEmiDto(int Number, DateOnly DueDate, long Principal, long Interest, long Total, bool Overdue);

/// <summary>A loan as the API returns it. Amounts in poisha; Outstanding is what is left to pay.</summary>
public sealed record LoanDto(
    Guid Id,
    LoanType Type,
    string Name,
    string? Lender,
    Guid WalletId,
    Guid PayFromWalletId,
    string? PayFromWalletName,
    long Principal,
    int RatePoints,
    int Months,
    long Emi,
    DateOnly FirstDueDate,
    int PaidBefore,
    bool AutoRecord,
    DateOnly? ClosedOn,
    long Outstanding,
    int Paid,
    int Left,
    bool Closed,
    NextEmiDto? Next,
    DateOnly? EndsOn,
    long InterestPaid,
    long InterestLeft);

/// <summary>An EMI coming up soon, for the "due" lists.</summary>
public sealed record DueEmiDto(Guid LoanId, string Name, LoanType Type, int Number, DateOnly DueDate, long Total, string? PayFromWalletName, bool Overdue);

public sealed record LoansSummary(long Outstanding, long Bank, long CardEmi, IReadOnlyList<DueEmiDto> Upcoming);

public sealed record LoanListDto(LoansSummary Summary, IReadOnlyList<LoanDto> Loans);

/// <param name="Status">Paid (recorded in TakaLeaf), PaidBefore (before the loan was added), Due or Upcoming.</param>
public sealed record ScheduleRowDto(
    int Number, DateOnly DueDate, string Status, long Principal, long Interest, long Total, long? BalanceAfter, DateTimeOffset? PaidAt, string? PaidFrom);

/// <summary>For a card EMI: how the card's limit is shared out. Held is what the card's EMIs have still to bill.</summary>
public sealed record CardLimitDto(Guid CardId, string CardName, long? Limit, long Spent, long Held, long? Available);

public sealed record LoanDetailDto(LoanDto Loan, IReadOnlyList<ScheduleRowDto> Schedule, IReadOnlyList<TransactionDto> Activity, CardLimitDto? Card);

/// <summary>
/// Adding a loan. For a bank loan already running, PaidBefore EMIs count as paid and the loan
/// starts from what is left today. ReceivedInWalletId: the wallet the loan money came into (none:
/// paid straight to a seller). Emi: the bank's own figure; worked out when left out.
/// </summary>
public sealed record AddLoanRequest(
    LoanType? Type,
    string? Name,
    string? Lender,
    Guid? PayFromWalletId,
    long? Principal,
    int? RatePoints,
    int? Months,
    long? Emi,
    DateOnly? FirstDueDate,
    int? PaidBefore,
    bool? AutoRecord,
    Guid? ReceivedInWalletId,
    long? ProcessingFee,
    Guid? PurchaseCategoryId);

/// <summary>Changing a loan. A new rate or EMI applies from the next EMI.</summary>
public sealed record UpdateLoanRequest(string? Name, string? Lender, Guid? PayFromWalletId, int? RatePoints, long? Emi, bool? AutoRecord);

/// <summary>Paying the next EMI. Amount: what was paid (default the EMI); interest stays, the rest is principal.</summary>
public sealed record PayEmiRequest(Guid? WalletId, long? Amount, long? LateFee, DateTimeOffset? OccurredAt);

public sealed record PayExtraRequest(Guid? WalletId, long? Amount, DateTimeOffset? OccurredAt);

/// <summary>
/// Settling early: pays everything left plus the bank's settlement charge, given as an amount or
/// as hundredths of a percent of what is left (ChargePoints 200 = 2 %).
/// </summary>
public sealed record SettleLoanRequest(Guid? WalletId, long? Charge, int? ChargePoints, DateTimeOffset? OccurredAt);

/// <summary>Where a loan stands now, worked out from its wallet balance and its recorded EMIs.</summary>
internal sealed record LoanState(long Outstanding, int Paid, IReadOnlyList<Instalment> Rest, long InterestPaid, bool Closed)
{
    public Instalment? NextInstalment => Rest.Count > 0 ? Rest[0] : null;
}

internal static class LoanRules
{
    public const int NameMax = 80;
    public const int MaxCatchUp = 24;
    public const string InterestCategoryName = "Loan interest";
    public const string SettlementNote = "Early settlement charge";
    public const string ProcessingFeeNote = "Processing fee";
    public const string LateFeeNote = "Late fee";

    public static DateOnly DueDateOf(Loan loan, int number) => loan.FirstDueDate.AddMonths(number - 1);

    public static Task<Loan?> FindOwnedAsync(AppDbContext db, Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Loans.FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId, cancellationToken);

    public static LoanState StateOf(Loan loan, long outstanding, int lastRecordedEmi, long interestRecorded)
    {
        var paid = Math.Max(loan.PaidBefore, lastRecordedEmi);
        var closed = loan.ClosedOn is not null || outstanding <= 0;
        var rest = closed ? [] : LoanMath.Schedule(outstanding, loan.RatePoints, loan.Emi, paid + 1);
        var interestPaid = LoanMath.InterestOfFirst(loan.Principal, loan.RatePoints, loan.Emi, loan.PaidBefore) + interestRecorded;
        return new LoanState(Math.Max(outstanding, 0), paid, rest, interestPaid, closed);
    }

    /// <summary>Wallet balances and recorded EMIs for every loan of a user, in three queries.</summary>
    public static async Task<Dictionary<Guid, LoanState>> StatesAsync(AppDbContext db, Guid userId, IReadOnlyList<Loan> loans, CancellationToken cancellationToken)
    {
        var movements = await Balances.MovementsAsync(db, userId, cancellationToken);
        var walletIds = loans.Select(l => l.WalletId).ToList();
        var openings = await db.Wallets.IgnoreQueryFilters()
            .Where(w => w.UserId == userId && walletIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.OpeningBalance, cancellationToken);
        var recorded = await db.Transactions
            .Where(t => t.UserId == userId && t.LoanId != null)
            .GroupBy(t => t.LoanId)
            .Select(g => new
            {
                LoanId = g.Key!.Value,
                LastEmi = g.Where(t => t.LoanPart == LoanPart.Principal).Max(t => t.LoanEmi),
                Interest = g.Where(t => t.LoanPart == LoanPart.Interest).Sum(t => (long?)t.Amount),
            })
            .ToDictionaryAsync(r => r.LoanId, cancellationToken);

        return loans.ToDictionary(loan => loan.Id, loan =>
        {
            var balance = openings.GetValueOrDefault(loan.WalletId) + movements.GetValueOrDefault(loan.WalletId);
            var row = recorded.GetValueOrDefault(loan.Id);
            return StateOf(loan, -balance, row?.LastEmi ?? 0, row?.Interest ?? 0);
        });
    }

    public static LoanDto ToDto(Loan loan, LoanState state, string? payFromName, DateOnly today)
    {
        var next = state.NextInstalment is { } n
            ? new NextEmiDto(n.Number, DueDateOf(loan, n.Number), n.Principal, n.Interest, n.Total, DueDateOf(loan, n.Number) < today)
            : null;
        DateOnly? endsOn = state.Rest.Count > 0 ? DueDateOf(loan, state.Rest[^1].Number) : null;
        return new LoanDto(
            loan.Id, loan.Type, loan.Name, loan.Lender, loan.WalletId, loan.PayFromWalletId, payFromName, loan.Principal, loan.RatePoints,
            loan.Months, loan.Emi, loan.FirstDueDate, loan.PaidBefore, loan.AutoRecord, loan.ClosedOn, state.Outstanding, state.Paid,
            state.Rest.Count, state.Closed, next, endsOn, state.InterestPaid, state.Rest.Sum(r => r.Interest));
    }

    /// <summary>
    /// The "Loan interest" expense category: an existing one (any level), else a new one under
    /// "Fees and charges", else a new main category.
    /// </summary>
    public static async Task<Guid> InterestCategoryAsync(AppDbContext db, Guid userId, CancellationToken cancellationToken)
    {
        var existing = await db.Categories
            .Where(c => c.UserId == userId && c.Kind == CategoryKind.Expense && c.Name == InterestCategoryName)
            .OrderBy(c => c.Archived)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is { } id)
        {
            return id;
        }

        var parent = await db.Categories
            .Where(c => c.UserId == userId && c.Kind == CategoryKind.Expense && c.ParentId == null && c.Name == TransactionRules.FeesCategoryName)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync(cancellationToken);
        var category = new Category { UserId = userId, Kind = CategoryKind.Expense, Name = InterestCategoryName, ParentId = parent, Icon = "percent", SortOrder = 99 };
        db.Categories.Add(category);
        return category.Id;
    }

    public static Task<Guid?> FeesCategoryAsync(AppDbContext db, Guid userId, CancellationToken cancellationToken) =>
        db.Categories
            .Where(c => c.UserId == userId && c.Kind == CategoryKind.Expense && c.ParentId == null && !c.Archived && c.Name == TransactionRules.FeesCategoryName)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync(cancellationToken);

    /// <summary>
    /// A wallet the user pays from: their own (not a loan's or a person's), not archived unless it
    /// is the current one. A card EMI is paid from a credit card.
    /// </summary>
    public static async Task<IResult?> CheckPayWalletAsync(
        AppDbContext db, Guid userId, Guid? walletId, string field, bool creditCard, Guid? current, CancellationToken cancellationToken)
    {
        if (walletId is not { } id)
        {
            return ValidationErrors.For(field, creditCard ? "Choose the credit card." : "Choose the wallet the EMIs are paid from.");
        }

        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId, cancellationToken);
        if (wallet is null)
        {
            return ValidationErrors.For(field, "That wallet does not exist.");
        }

        if (wallet.Type is WalletType.Lent or WalletType.Borrowed or WalletType.Loan)
        {
            return ValidationErrors.For(field, "Choose one of your own wallets, like your bank account or bKash.");
        }

        if (creditCard && wallet.Type != WalletType.CreditCard)
        {
            return ValidationErrors.For(field, "Choose a credit card.");
        }

        return wallet.Archived && id != current ? ValidationErrors.For(field, "That wallet is archived. Unarchive it to use it.") : null;
    }

    /// <summary>The EMI must at least cover the first month's interest, or the loan would never end.</summary>
    public static IResult? CheckEmi(long emi, long balance, int ratePoints)
    {
        if (emi <= 0 || emi > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("emi", "Enter the EMI, more than zero.");
        }

        return emi <= LoanMath.MonthlyInterest(balance, ratePoints)
            ? ValidationErrors.For("emi", $"The EMI must be more than a month's interest ({Money.Format(LoanMath.MonthlyInterest(balance, ratePoints))}), or the loan never ends.")
            : null;
    }

    public static Transaction Row(Loan loan, LoanPart part, TransactionType type, long amount, Guid? from, Guid? to, Guid? categoryId, int? emi, DateTimeOffset at, string? note) => new()
    {
        UserId = loan.UserId,
        LoanId = loan.Id,
        LoanPart = part,
        LoanEmi = emi,
        Type = type,
        Amount = amount,
        FromWalletId = from,
        ToWalletId = to,
        CategoryId = categoryId,
        OccurredAt = at.ToUniversalTime(),
        Note = note,
    };

    /// <summary>
    /// Records the next EMI: principal into the loan's wallet, interest as an expense, and an
    /// optional late fee. Amount, when given, is the whole payment; interest is fixed, so the rest
    /// is principal. Saves nothing; returns the rows added.
    /// </summary>
    public static async Task<(List<Transaction>? Rows, IResult? Problem)> AddEmiAsync(
        AppDbContext db, Loan loan, LoanState state, Guid walletId, long? amount, long lateFee, DateTimeOffset at, CancellationToken cancellationToken)
    {
        if (state.NextInstalment is not { } next)
        {
            return (null, Results.Problem(title: "This loan is paid off.", statusCode: StatusCodes.Status400BadRequest));
        }

        var principal = next.Principal;
        if (amount is { } paid)
        {
            principal = paid - next.Interest;
            if (paid <= 0 || paid > TransactionRules.MaxAmount || principal <= 0)
            {
                return (null, ValidationErrors.For("amount", $"Pay more than this month's interest, {Money.Format(next.Interest)}."));
            }

            if (principal > state.Outstanding)
            {
                return (null, ValidationErrors.For("amount", $"That is more than is left. To pay it all, settle the loan instead."));
            }
        }

        if (lateFee < 0 || lateFee > TransactionRules.MaxAmount)
        {
            return (null, ValidationErrors.For("lateFee", "The late fee must be zero or more."));
        }

        var rows = new List<Transaction>
        {
            Row(loan, LoanPart.Principal, TransactionType.Transfer, principal, walletId, loan.WalletId, null, next.Number, at, $"{loan.Name} EMI {next.Number}"),
        };
        if (next.Interest > 0)
        {
            rows.Add(Row(loan, LoanPart.Interest, TransactionType.Expense, next.Interest, walletId, null,
                await InterestCategoryAsync(db, loan.UserId, cancellationToken), next.Number, at, $"{loan.Name} interest"));
        }

        if (lateFee > 0)
        {
            rows.Add(Row(loan, LoanPart.Fee, TransactionType.Expense, lateFee, walletId, null,
                await FeesCategoryAsync(db, loan.UserId, cancellationToken), next.Number, at, LateFeeNote));
        }

        db.Transactions.AddRange(rows);
        return (rows, null);
    }

    /// <summary>The loan's latest DTO, read fresh after a change.</summary>
    public static async Task<LoanDto> DtoAsync(AppDbContext db, LocalCalendar calendar, Loan loan, CancellationToken cancellationToken)
    {
        var state = (await StatesAsync(db, loan.UserId, [loan], cancellationToken))[loan.Id];
        var payFrom = await db.Wallets.IgnoreQueryFilters().Where(w => w.Id == loan.PayFromWalletId).Select(w => w.Name).FirstOrDefaultAsync(cancellationToken);
        return ToDto(loan, state, payFrom, calendar.Today());
    }
}
