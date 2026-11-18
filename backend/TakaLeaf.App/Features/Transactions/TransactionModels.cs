using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>
/// A transaction as the API returns it, with wallet and category names for display. Amounts are
/// in poisha. A transfer carries its Fee; the fee itself is also an expense row with FeeOfId set.
/// </summary>
public sealed record TransactionDto(
    Guid Id,
    TransactionType Type,
    long Amount,
    Guid? FromWalletId,
    string? FromWalletName,
    Guid? ToWalletId,
    string? ToWalletName,
    Guid? CategoryId,
    string? CategoryName,
    Guid? PersonId,
    Guid? FeeOfId,
    long? Fee,
    DateTimeOffset OccurredAt,
    string? Note,
    Guid? RecurringRuleId,
    Guid? LoanId = null,
    Guid? SavingId = null);

/// <summary>
/// Adding and editing take the same fields; an edit replaces all of them.
/// Income needs ToWalletId, expense needs FromWalletId, a transfer needs both.
/// </summary>
/// <param name="Fee">Transfers only, in poisha: for example an MFS cash-out charge.</param>
/// <param name="FeeCategoryId">Where the fee is counted. Default: the "Fees and charges" category.</param>
public sealed record TransactionRequest(
    TransactionType? Type,
    long? Amount,
    Guid? FromWalletId,
    Guid? ToWalletId,
    Guid? CategoryId,
    DateTimeOffset? OccurredAt,
    string? Note,
    long? Fee,
    Guid? FeeCategoryId);

internal sealed record CheckedTransaction(
    TransactionType Type,
    long Amount,
    Guid? FromWalletId,
    Guid? ToWalletId,
    Guid? CategoryId,
    DateTimeOffset OccurredAt,
    string? Note,
    long Fee,
    Guid? FeeCategoryId);

internal static class TransactionRules
{
    /// <summary>One trillion taka, in poisha. Far above any real entry; it catches typing mistakes.</summary>
    public const long MaxAmount = 100_000_000_000_000;
    public const int NoteMax = 500;
    public const string FeesCategoryName = "Fees and charges";
    public const string FeeNote = "Transfer fee";

    public static Task<Transaction?> FindOwnedAsync(AppDbContext db, Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Transactions.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, cancellationToken);

    /// <summary>A fee row or a loan is changed elsewhere; returns the 400 response, or null.</summary>
    public static IResult? ManagedElsewhere(Transaction transaction)
    {
        if (transaction.FeeOfId is not null)
        {
            return Results.Problem(title: "This is a transfer fee. Change it on its transfer.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (transaction.PersonId is not null)
        {
            return Results.Problem(title: "Loans and repayments are changed from People.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (transaction.LoanId is not null)
        {
            return Results.Problem(title: "This is part of a bank loan or card EMI. Change it from Loans.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (transaction.SavingId is not null)
        {
            return Results.Problem(title: "This is part of a saving or policy. Change it from Savings.", statusCode: StatusCodes.Status400BadRequest);
        }

        return null;
    }

    /// <summary>
    /// Checks a request against the rules and the account's wallets and categories. When editing,
    /// a wallet or category that is archived may stay as it was, but none can be newly chosen.
    /// </summary>
    public static async Task<(CheckedTransaction? Value, IResult? Problem)> CheckAsync(
        AppDbContext db,
        Guid userId,
        TransactionRequest request,
        Transaction? existing,
        Guid? existingFeeCategoryId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (request.Type is not { } type || !Enum.IsDefined(type))
        {
            return Fail("type", "Choose Income, Expense or Transfer.");
        }

        if (request.Amount is not { } amount || amount <= 0 || amount > MaxAmount)
        {
            return Fail("amount", "Enter an amount above zero.");
        }

        var from = request.FromWalletId;
        var to = request.ToWalletId;
        switch (type)
        {
            case TransactionType.Income when to is null:
                return Fail("toWalletId", "Choose the wallet the money came into.");
            case TransactionType.Income when from is not null:
                return Fail("fromWalletId", "Income only goes into a wallet.");
            case TransactionType.Expense when from is null:
                return Fail("fromWalletId", "Choose the wallet the money left.");
            case TransactionType.Expense when to is not null:
                return Fail("toWalletId", "An expense only leaves a wallet.");
            case TransactionType.Transfer when from is null:
                return Fail("fromWalletId", "Choose the wallet the money left.");
            case TransactionType.Transfer when to is null:
                return Fail("toWalletId", "Choose the wallet the money went to.");
            case TransactionType.Transfer when from == to:
                return Fail("toWalletId", "Choose two different wallets.");
        }

        if (from is { } fromId && await CheckWalletAsync(db, userId, fromId, existing?.FromWalletId, "fromWalletId", cancellationToken) is { } fromProblem)
        {
            return (null, fromProblem);
        }

        if (to is { } toId && await CheckWalletAsync(db, userId, toId, existing?.ToWalletId, "toWalletId", cancellationToken) is { } toProblem)
        {
            return (null, toProblem);
        }

        var categoryId = request.CategoryId;
        if (type == TransactionType.Transfer)
        {
            if (categoryId is not null)
            {
                return Fail("categoryId", "A transfer has no category.");
            }
        }
        else if (categoryId is { } chosen)
        {
            var kind = type == TransactionType.Income ? CategoryKind.Income : CategoryKind.Expense;
            if (await CheckCategoryAsync(db, userId, chosen, kind, existing?.CategoryId, "categoryId", cancellationToken) is { } categoryProblem)
            {
                return (null, categoryProblem);
            }
        }

        var fee = request.Fee ?? 0;
        Guid? feeCategoryId = null;
        if (fee < 0 || fee > MaxAmount)
        {
            return Fail("fee", "The fee must be zero or more.");
        }

        if (fee > 0)
        {
            if (type != TransactionType.Transfer)
            {
                return Fail("fee", "Only a transfer has a fee.");
            }

            if (request.FeeCategoryId is { } feeCategory)
            {
                if (await CheckCategoryAsync(db, userId, feeCategory, CategoryKind.Expense, existingFeeCategoryId, "feeCategoryId", cancellationToken) is { } feeProblem)
                {
                    return (null, feeProblem);
                }

                feeCategoryId = feeCategory;
            }
            else
            {
                feeCategoryId = await db.Categories
                    .Where(c => c.UserId == userId && c.Kind == CategoryKind.Expense && c.ParentId == null && !c.Archived && c.Name == FeesCategoryName)
                    .Select(c => (Guid?)c.Id)
                    .FirstOrDefaultAsync(cancellationToken);
            }
        }

        var note = Text.Clean(request.Note);
        if (note is { Length: > NoteMax })
        {
            return Fail("note", $"Keep the note to {NoteMax} characters.");
        }

        var occurredAt = (request.OccurredAt ?? now).ToUniversalTime();
        return (new CheckedTransaction(type, amount, from, to, categoryId, occurredAt, note, fee, feeCategoryId), null);
    }

    public static void Apply(Transaction transaction, CheckedTransaction input)
    {
        transaction.Type = input.Type;
        transaction.Amount = input.Amount;
        transaction.FromWalletId = input.FromWalletId;
        transaction.ToWalletId = input.ToWalletId;
        transaction.CategoryId = input.CategoryId;
        transaction.OccurredAt = input.OccurredAt;
        transaction.Note = input.Note;
    }

    /// <summary>Makes the fee row match its transfer: same wallet and time, the fee's amount and category.</summary>
    public static void ApplyFee(Transaction fee, Transaction transfer, CheckedTransaction input)
    {
        fee.UserId = transfer.UserId;
        fee.Type = TransactionType.Expense;
        fee.Amount = input.Fee;
        fee.FromWalletId = input.FromWalletId;
        fee.ToWalletId = null;
        fee.CategoryId = input.FeeCategoryId;
        fee.FeeOfId = transfer.Id;
        fee.OccurredAt = input.OccurredAt;
        fee.Note = FeeNote;
    }

    public static async Task<List<TransactionDto>> ToDtosAsync(
        AppDbContext db,
        Guid userId,
        IReadOnlyList<Transaction> rows,
        CancellationToken cancellationToken)
    {
        // Names of deleted or merged wallets and categories still show on old entries.
        var walletNames = await db.Wallets.IgnoreQueryFilters()
            .Where(w => w.UserId == userId)
            .ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
        var categoryNames = await db.Categories.IgnoreQueryFilters()
            .Where(c => c.UserId == userId)
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);

        var transferIds = rows.Where(r => r.Type == TransactionType.Transfer).Select(r => r.Id).ToList();
        var fees = transferIds.Count == 0
            ? new Dictionary<Guid, long>()
            : await db.Transactions
                .Where(t => t.UserId == userId && t.FeeOfId != null && transferIds.Contains(t.FeeOfId.Value))
                .ToDictionaryAsync(t => t.FeeOfId!.Value, t => t.Amount, cancellationToken);

        return rows.Select(t => new TransactionDto(
            t.Id,
            t.Type,
            t.Amount,
            t.FromWalletId,
            NameOf(walletNames, t.FromWalletId),
            t.ToWalletId,
            NameOf(walletNames, t.ToWalletId),
            t.CategoryId,
            NameOf(categoryNames, t.CategoryId),
            t.PersonId,
            t.FeeOfId,
            fees.TryGetValue(t.Id, out var fee) ? fee : null,
            t.OccurredAt,
            t.Note,
            t.RecurringRuleId,
            t.LoanId,
            t.SavingId)).ToList();
    }

    private static string? NameOf(Dictionary<Guid, string> names, Guid? id) =>
        id is { } key && names.TryGetValue(key, out var name) ? name : null;

    private static async Task<IResult?> CheckWalletAsync(
        AppDbContext db, Guid userId, Guid id, Guid? current, string field, CancellationToken cancellationToken)
    {
        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId, cancellationToken);
        if (wallet is null)
        {
            return ValidationErrors.For(field, "That wallet does not exist.");
        }

        if (wallet.Type is WalletType.Lent or WalletType.Borrowed)
        {
            return ValidationErrors.For(field, "Lending and borrowing are recorded from People.");
        }

        if (wallet.Type == WalletType.Loan)
        {
            return ValidationErrors.For(field, "Loan payments are recorded from Loans.");
        }

        if (wallet.Type == WalletType.Savings)
        {
            return ValidationErrors.For(field, "Money in savings is recorded from Savings.");
        }

        return wallet.Archived && id != current
            ? ValidationErrors.For(field, "That wallet is archived. Unarchive it to use it.")
            : null;
    }

    private static async Task<IResult?> CheckCategoryAsync(
        AppDbContext db, Guid userId, Guid id, CategoryKind kind, Guid? current, string field, CancellationToken cancellationToken)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, cancellationToken);
        if (category is null)
        {
            return ValidationErrors.For(field, "That category does not exist.");
        }

        if (category.Kind != kind)
        {
            return ValidationErrors.For(field, kind == CategoryKind.Income ? "Choose an income category." : "Choose an expense category.");
        }

        return category.Archived && id != current
            ? ValidationErrors.For(field, "That category is archived. Unarchive it to use it.")
            : null;
    }

    private static (CheckedTransaction? Value, IResult? Problem) Fail(string field, string message) =>
        (null, ValidationErrors.For(field, message));
}
