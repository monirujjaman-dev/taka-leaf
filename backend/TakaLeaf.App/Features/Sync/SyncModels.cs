using Microsoft.AspNetCore.Http.HttpResults;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Sync;

// Rows as the Android app stores them: every field of the table, plus the sync columns. Amounts are
// in poisha. Pull sends ServerSeq; push ignores it, and ignores any user id (the token decides).

public sealed record WalletRow(
    Guid Id,
    WalletType Type,
    string Name,
    long OpeningBalance,
    long? CreditLimit,
    Guid? PersonId,
    string? Icon,
    string? Color,
    bool Archived,
    bool ExcludedFromTotal,
    int SortOrder,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? DeletedAt,
    long ServerSeq = 0);

public sealed record CategoryRow(
    Guid Id,
    CategoryKind Kind,
    string Name,
    Guid? ParentId,
    string? Icon,
    string? Color,
    bool Archived,
    int SortOrder,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? DeletedAt,
    long ServerSeq = 0);

public sealed record PersonRow(
    Guid Id,
    string Name,
    string? Note,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? DeletedAt,
    long ServerSeq = 0);

public sealed record TransactionRow(
    Guid Id,
    TransactionType Type,
    long Amount,
    Guid? FromWalletId,
    Guid? ToWalletId,
    Guid? CategoryId,
    Guid? PersonId,
    Guid? FeeOfId,
    Guid? RecurringRuleId,
    DateOnly? RecurringDate,
    DateTimeOffset OccurredAt,
    string? Note,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? DeletedAt,
    long ServerSeq = 0,
    Guid? LoanId = null,
    int? LoanEmi = null,
    LoanPart? LoanPart = null);

public sealed record LoanRow(
    Guid Id,
    LoanType Type,
    string Name,
    string? Lender,
    Guid WalletId,
    Guid PayFromWalletId,
    long Principal,
    int RatePoints,
    int Months,
    long Emi,
    DateOnly FirstDueDate,
    int PaidBefore,
    bool AutoRecord,
    DateOnly? ClosedOn,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? DeletedAt,
    long ServerSeq = 0);

public sealed record BudgetRow(
    Guid Id,
    Guid? CategoryId,
    long Amount,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? DeletedAt,
    long ServerSeq = 0);

public sealed record RecurringRuleRow(
    Guid Id,
    TransactionType Type,
    long Amount,
    Guid? FromWalletId,
    Guid? ToWalletId,
    Guid? CategoryId,
    string? Note,
    RecurringFrequency Frequency,
    int Interval,
    DateOnly StartDate,
    DateOnly? EndDate,
    int Occurrences,
    DateOnly NextDate,
    bool AutoRecord,
    bool Paused,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? DeletedAt,
    long ServerSeq = 0);

/// <param name="Cursor">Send it back as the next pull's cursor. It only moves forward.</param>
/// <param name="HasMore">Pull again straight away: more changes are waiting.</param>
public sealed record PullResponse(
    long Cursor,
    bool HasMore,
    List<WalletRow> Wallets,
    List<CategoryRow> Categories,
    List<PersonRow> People,
    List<TransactionRow> Transactions,
    List<BudgetRow> Budgets,
    List<RecurringRuleRow> RecurringRules,
    List<LoanRow> Loans);

/// <param name="Protocol">The sync version the app speaks; see <see cref="SyncRules.Protocol"/>.</param>
/// <param name="Changes">Oldest first. A change to a row the server already has replaces all of its fields.</param>
public sealed record PushRequest(int? Protocol, List<PushChange>? Changes);

/// <param name="MutationId">Made by the phone for each change, echoed in the result.</param>
/// <param name="Table">wallets, categories, people, transactions, budgets, recurringRules or loans.</param>
/// <param name="Row">The whole row; DeletedAt set means delete it.</param>
public sealed record PushChange(Guid MutationId, string? Table, System.Text.Json.JsonElement Row);

/// <param name="Status">accepted, superseded (a later change on the server won) or rejected (with a reason).</param>
/// <param name="Current">The row as the server now has it, for the phone to store; null when the server has none.</param>
public sealed record PushResult(Guid MutationId, string Status, string? Reason, object? Current);

public sealed record PushResponse(List<PushResult> Results);

internal static class SyncRules
{
    /// <summary>The sync version this server speaks. Raise it when rows or rules change in a way an older app would get wrong.</summary>
    public const int Protocol = 1;

    /// <summary>Oldest app sync version still accepted; older apps are told to update.</summary>
    public const int MinProtocol = 1;

    public const int PageSize = 500;

    public const int MaxBatch = 200;

    /// <summary>A phone clock this far ahead of the server is treated as wrong, and the server's time is used.</summary>
    public static readonly TimeSpan ClockTolerance = TimeSpan.FromMinutes(5);

    public const string Accepted = "accepted";
    public const string Superseded = "superseded";
    public const string Rejected = "rejected";

    public static IResult? ProtocolProblem(int? protocol) => protocol switch
    {
        null => ValidationErrors.For("protocol", "Say which sync version the app speaks."),
        < MinProtocol => Results.Problem(
            title: "Update TakaLeaf for Android to keep syncing. Your changes on the phone are kept.",
            statusCode: StatusCodes.Status426UpgradeRequired),
        > Protocol => Results.Problem(
            title: "This server runs an older TakaLeaf. Ask its owner to update it.",
            statusCode: StatusCodes.Status400BadRequest),
        _ => null,
    };

    /// <summary>The first message of a validation or problem response, for a rejected change.</summary>
    public static string ReasonOf(IResult problem) => problem switch
    {
        ValidationProblem validation => validation.ProblemDetails.Errors.Values.SelectMany(messages => messages).FirstOrDefault()
            ?? validation.ProblemDetails.Title ?? "This change is not valid.",
        ProblemHttpResult other => other.ProblemDetails.Title ?? "This change is not valid.",
        _ => "This change is not valid.",
    };

    public static WalletRow ToRow(Wallet w) => new(
        w.Id, w.Type, w.Name, w.OpeningBalance, w.CreditLimit, w.PersonId, w.Icon, w.Color, w.Archived, w.ExcludedFromTotal,
        w.SortOrder, w.UpdatedAt, w.DeletedAt, w.ServerSeq);

    public static CategoryRow ToRow(Category c) => new(
        c.Id, c.Kind, c.Name, c.ParentId, c.Icon, c.Color, c.Archived, c.SortOrder, c.UpdatedAt, c.DeletedAt, c.ServerSeq);

    public static PersonRow ToRow(Person p) => new(p.Id, p.Name, p.Note, p.UpdatedAt, p.DeletedAt, p.ServerSeq);

    public static TransactionRow ToRow(Transaction t) => new(
        t.Id, t.Type, t.Amount, t.FromWalletId, t.ToWalletId, t.CategoryId, t.PersonId, t.FeeOfId, t.RecurringRuleId,
        t.RecurringDate, t.OccurredAt, t.Note, t.UpdatedAt, t.DeletedAt, t.ServerSeq, t.LoanId, t.LoanEmi, t.LoanPart);

    public static LoanRow ToRow(Loan l) => new(
        l.Id, l.Type, l.Name, l.Lender, l.WalletId, l.PayFromWalletId, l.Principal, l.RatePoints, l.Months, l.Emi, l.FirstDueDate,
        l.PaidBefore, l.AutoRecord, l.ClosedOn, l.UpdatedAt, l.DeletedAt, l.ServerSeq);

    public static BudgetRow ToRow(Budget b) => new(b.Id, b.CategoryId, b.Amount, b.UpdatedAt, b.DeletedAt, b.ServerSeq);

    public static RecurringRuleRow ToRow(RecurringRule r) => new(
        r.Id, r.Type, r.Amount, r.FromWalletId, r.ToWalletId, r.CategoryId, r.Note, r.Frequency, r.Interval, r.StartDate,
        r.EndDate, r.Occurrences, r.NextDate, r.AutoRecord, r.Paused, r.UpdatedAt, r.DeletedAt, r.ServerSeq);
}
