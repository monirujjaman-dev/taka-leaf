using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Categories;
using TakaLeaf.App.Features.People;
using TakaLeaf.App.Features.Recurring;
using TakaLeaf.App.Features.Transactions;
using TakaLeaf.App.Features.Wallets;

namespace TakaLeaf.App.Features.Sync;

/// <summary>
/// Applies one pushed row. The rules are the API's own (wallet names, transaction shapes, category
/// kinds...), checked per row; the phone sends related rows (a transfer and its fee, a person and
/// their loan wallets) as separate changes, parents first.
/// </summary>
internal sealed class SyncPush(AppDbContext db, Guid userId, DateTimeOffset now, JsonSerializerOptions json)
{
    public async Task<PushResult> ApplyAsync(PushChange change, CancellationToken cancellationToken)
    {
        try
        {
            return change.Table switch
            {
                "wallets" => await WalletAsync(change.MutationId, Read<WalletRow>(change), cancellationToken),
                "categories" => await CategoryAsync(change.MutationId, Read<CategoryRow>(change), cancellationToken),
                "people" => await PersonAsync(change.MutationId, Read<PersonRow>(change), cancellationToken),
                "transactions" => await TransactionAsync(change.MutationId, Read<TransactionRow>(change), cancellationToken),
                "budgets" => await BudgetAsync(change.MutationId, Read<BudgetRow>(change), cancellationToken),
                "recurringRules" => await RecurringAsync(change.MutationId, Read<RecurringRuleRow>(change), cancellationToken),
                _ => Result(change.MutationId, SyncRules.Rejected, "This kind of change is not known to the server.", null),
            };
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException { Source: "System.Text.Json" })
        {
            return Result(change.MutationId, SyncRules.Rejected, "This change could not be read.", null);
        }
    }

    /// <summary>After a unique index refused the change: tell the phone what the server has instead.</summary>
    public async Task<PushResult> ClashAsync(PushChange change, CancellationToken cancellationToken)
    {
        if (change.Table == "transactions")
        {
            var row = Read<TransactionRow>(change);
            var current = await db.Transactions.IgnoreQueryFilters().AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == row.Id && t.UserId == userId, cancellationToken);
            if (row.RecurringRuleId is not null)
            {
                return Result(change.MutationId, SyncRules.Superseded, "This date was already recorded.", current is null ? null : SyncRules.ToRow(current));
            }
        }

        return Result(change.MutationId, SyncRules.Rejected, "This clashes with something already on the server.", null);
    }

    private T Read<T>(PushChange change) =>
        change.Row.ValueKind == JsonValueKind.Object
            ? change.Row.Deserialize<T>(json) ?? throw new JsonException("Empty row.")
            : throw new JsonException("The row is not an object.");

    private static PushResult Result(Guid mutationId, string status, string? reason, object? current) =>
        new(mutationId, status, reason, current);

    /// <summary>
    /// The steps every table shares: ownership, the later change wins, deletes stay deleted, then
    /// the table's own checks and fields.
    /// </summary>
    private async Task<PushResult> UpsertAsync<T>(
        Guid mutationId,
        DbSet<T> set,
        Guid id,
        DateTimeOffset updatedAt,
        bool delete,
        Func<T?, Task<string?>> check,
        Action<T> apply,
        Func<T, Task<string?>> deleteCheck,
        Func<T, Task> onDelete,
        Func<T, object> toRow,
        CancellationToken cancellationToken)
        where T : SyncedEntity, new()
    {
        var existing = await set.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (existing is not null && existing.UserId != userId)
        {
            return Result(mutationId, SyncRules.Rejected, "That does not exist.", null);
        }

        // A phone clock far ahead must not win every conflict: use the time the server received it.
        var changedAt = updatedAt > now + SyncRules.ClockTolerance ? now : updatedAt;
        if (existing is { DeletedAt: not null })
        {
            return Result(mutationId, SyncRules.Superseded, "It was deleted on another device.", toRow(existing));
        }

        if (existing is not null && existing.UpdatedAt > changedAt)
        {
            return Result(mutationId, SyncRules.Superseded, "It was changed on another device after this.", toRow(existing));
        }

        if (delete)
        {
            if (existing is null)
            {
                return Result(mutationId, SyncRules.Accepted, null, null);
            }

            if (await deleteCheck(existing) is { } refusal)
            {
                return Result(mutationId, SyncRules.Rejected, refusal, toRow(existing));
            }

            existing.DeletedAt = now;
            await onDelete(existing);
            await db.SaveChangesAsync(cancellationToken);
            return Result(mutationId, SyncRules.Accepted, null, toRow(existing));
        }

        if (await check(existing) is { } reason)
        {
            return Result(mutationId, SyncRules.Rejected, reason, existing is null ? null : toRow(existing));
        }

        var row = existing ?? new T { Id = id, UserId = userId };
        if (existing is null)
        {
            set.Add(row);
        }

        apply(row);
        await db.SaveChangesAsync(cancellationToken);
        return Result(mutationId, SyncRules.Accepted, null, toRow(row));
    }

    private static Task<string?> Fine<T>(T _) => Task.FromResult<string?>(null);

    private static Task Nothing<T>(T _) => Task.CompletedTask;

    // Wallets

    private Task<PushResult> WalletAsync(Guid mutationId, WalletRow row, CancellationToken cancellationToken) =>
        UpsertAsync(
            mutationId, db.Wallets, row.Id, row.UpdatedAt, row.DeletedAt is not null,
            existing => CheckWalletAsync(row, existing, cancellationToken),
            wallet =>
            {
                wallet.Type = row.Type;
                wallet.Name = Text.Clean(row.Name)!;
                wallet.OpeningBalance = row.OpeningBalance;
                wallet.CreditLimit = row.CreditLimit;
                wallet.PersonId = row.PersonId;
                wallet.Icon = Text.Clean(row.Icon);
                wallet.Color = Text.Clean(row.Color);
                wallet.Archived = row.Archived;
                wallet.ExcludedFromTotal = row.ExcludedFromTotal;
                wallet.SortOrder = row.SortOrder;
            },
            async wallet =>
            {
                if (await db.Transactions.AnyAsync(t => t.UserId == userId && (t.FromWalletId == wallet.Id || t.ToWalletId == wallet.Id), cancellationToken))
                {
                    return "This wallet has transactions. Archive it instead.";
                }

                return await db.RecurringRules.AnyAsync(r => r.UserId == userId && (r.FromWalletId == wallet.Id || r.ToWalletId == wallet.Id), cancellationToken)
                    ? "A recurring transaction uses this wallet. Change or delete it first."
                    : null;
            },
            Nothing,
            wallet => SyncRules.ToRow(wallet),
            cancellationToken);

    private async Task<string?> CheckWalletAsync(WalletRow row, Wallet? existing, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(row.Type))
        {
            return "Choose a wallet type.";
        }

        var personWallet = WalletRules.IsPersonWallet(row.Type);
        if (existing is not null && existing.Type != row.Type && (personWallet || WalletRules.IsPersonWallet(existing.Type)))
        {
            return "A lent or borrowed wallet keeps its type.";
        }

        if (Math.Abs(row.OpeningBalance) > TransactionRules.MaxAmount)
        {
            return "The opening balance is too large.";
        }

        var name = Text.Clean(row.Name);
        if (name is null)
        {
            return "Give the wallet a name.";
        }

        if (!personWallet)
        {
            if (row.PersonId is not null)
            {
                return "Only a lent or borrowed wallet belongs to a person.";
            }

            var problem = await WalletRules.CheckFieldsAsync(
                db, userId, row.Id, row.Type, name, row.CreditLimit, Text.Clean(row.Icon), Text.Clean(row.Color), cancellationToken);
            return problem is null ? null : SyncRules.ReasonOf(problem);
        }

        if (name.Length > WalletRules.NameMax)
        {
            return $"Give the wallet a name of up to {WalletRules.NameMax} characters.";
        }

        if (row.CreditLimit is not null)
        {
            return "Only a credit card has a credit limit.";
        }

        return row.PersonId is { } personId && await db.People.AnyAsync(p => p.Id == personId && p.UserId == userId, cancellationToken)
            ? null
            : "That person does not exist.";
    }

    // Categories

    private Task<PushResult> CategoryAsync(Guid mutationId, CategoryRow row, CancellationToken cancellationToken) =>
        UpsertAsync(
            mutationId, db.Categories, row.Id, row.UpdatedAt, row.DeletedAt is not null,
            existing => CheckCategoryAsync(row, existing, cancellationToken),
            category =>
            {
                category.Kind = row.Kind;
                category.Name = Text.Clean(row.Name)!;
                category.ParentId = row.ParentId;
                category.Icon = Text.Clean(row.Icon);
                category.Color = Text.Clean(row.Color);
                category.Archived = row.Archived;
                category.SortOrder = row.SortOrder;
            },
            async category =>
            {
                if (await db.Categories.AnyAsync(c => c.UserId == userId && c.ParentId == category.Id, cancellationToken))
                {
                    return "This category has sub-categories. Delete or move them first.";
                }

                if (await db.Transactions.AnyAsync(t => t.UserId == userId && t.CategoryId == category.Id, cancellationToken))
                {
                    return "Transactions use this category. Archive it, or merge it into another.";
                }

                return await db.RecurringRules.AnyAsync(r => r.UserId == userId && r.CategoryId == category.Id, cancellationToken)
                    ? "A recurring transaction uses this category. Change or delete it first."
                    : null;
            },
            async category =>
            {
                // Its budget has nothing left to measure, as when deleting through the API.
                var budget = await db.Budgets.FirstOrDefaultAsync(b => b.UserId == userId && b.CategoryId == category.Id, cancellationToken);
                if (budget is not null)
                {
                    budget.DeletedAt = now;
                }
            },
            category => SyncRules.ToRow(category),
            cancellationToken);

    private async Task<string?> CheckCategoryAsync(CategoryRow row, Category? existing, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(row.Kind))
        {
            return "Choose income or expense.";
        }

        if (existing is not null && existing.Kind != row.Kind)
        {
            return "A category stays income or expense.";
        }

        var name = Text.Clean(row.Name);
        if (name is null)
        {
            return "Give the category a name.";
        }

        if (row.ParentId is { } parentId)
        {
            if (parentId == row.Id)
            {
                return "A category can't be inside itself.";
            }

            var parent = await db.Categories.FirstOrDefaultAsync(c => c.Id == parentId && c.UserId == userId, cancellationToken);
            if (parent is null)
            {
                return "That parent category does not exist.";
            }

            if (parent.ParentId is not null)
            {
                return "Sub-categories go only one level deep.";
            }

            if (parent.Kind != row.Kind)
            {
                return "A sub-category has the same kind as its parent.";
            }

            if (await db.Categories.AnyAsync(c => c.UserId == userId && c.ParentId == row.Id, cancellationToken))
            {
                return "This category has sub-categories, so it can't go inside another.";
            }
        }

        var problem = await CategoryRules.CheckFieldsAsync(
            db, userId, row.Id, row.Kind, row.ParentId, name, Text.Clean(row.Icon), Text.Clean(row.Color), cancellationToken);
        return problem is null ? null : SyncRules.ReasonOf(problem);
    }

    // People

    private Task<PushResult> PersonAsync(Guid mutationId, PersonRow row, CancellationToken cancellationToken) =>
        UpsertAsync(
            mutationId, db.People, row.Id, row.UpdatedAt, row.DeletedAt is not null,
            async _ =>
            {
                var (_, _, problem) = await PeopleRules.CheckAsync(db, userId, row.Id, new PersonRequest(row.Name, row.Note), cancellationToken);
                return problem is null ? null : SyncRules.ReasonOf(problem);
            },
            person =>
            {
                person.Name = Text.Clean(row.Name)!;
                person.Note = Text.Clean(row.Note);
            },
            async person => await db.Transactions.AnyAsync(t => t.UserId == userId && t.PersonId == person.Id, cancellationToken)
                ? $"{person.Name} has loans recorded. Delete those first."
                : null,
            async person =>
            {
                // The person's Lent and Borrowed wallets go with them, as when deleting through the API.
                foreach (var wallet in await db.Wallets.Where(w => w.UserId == userId && w.PersonId == person.Id).ToListAsync(cancellationToken))
                {
                    wallet.DeletedAt = now;
                }
            },
            person => SyncRules.ToRow(person),
            cancellationToken);

    // Transactions

    private Task<PushResult> TransactionAsync(Guid mutationId, TransactionRow row, CancellationToken cancellationToken) =>
        UpsertAsync(
            mutationId, db.Transactions, row.Id, row.UpdatedAt, row.DeletedAt is not null,
            existing => CheckTransactionAsync(row, existing, cancellationToken),
            transaction =>
            {
                transaction.Type = row.Type;
                transaction.Amount = row.Amount;
                transaction.FromWalletId = row.FromWalletId;
                transaction.ToWalletId = row.ToWalletId;
                transaction.CategoryId = row.CategoryId;
                transaction.PersonId = row.PersonId;
                transaction.FeeOfId = row.FeeOfId;
                transaction.RecurringRuleId = row.RecurringRuleId;
                transaction.RecurringDate = row.RecurringDate;
                transaction.OccurredAt = row.OccurredAt.ToUniversalTime();
                transaction.Note = Text.Clean(row.Note);
            },
            Fine,
            async transaction =>
            {
                // A transfer's fee goes with it.
                if (transaction.Type == TransactionType.Transfer)
                {
                    foreach (var fee in await db.Transactions.Where(t => t.UserId == userId && t.FeeOfId == transaction.Id).ToListAsync(cancellationToken))
                    {
                        fee.DeletedAt = now;
                    }
                }
            },
            transaction => SyncRules.ToRow(transaction),
            cancellationToken);

    private async Task<string?> CheckTransactionAsync(TransactionRow row, Transaction? existing, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(row.Type))
        {
            return "Choose Income, Expense or Transfer.";
        }

        if (row.Amount <= 0 || row.Amount > TransactionRules.MaxAmount)
        {
            return "Enter an amount above zero.";
        }

        if (Text.Clean(row.Note) is { Length: > TransactionRules.NoteMax })
        {
            return $"Keep the note to {TransactionRules.NoteMax} characters.";
        }

        if (row.RecurringDate is null != row.RecurringRuleId is null)
        {
            return "A recurring date goes with its recurring transaction.";
        }

        if (row.RecurringRuleId is { } ruleId
            && !await db.RecurringRules.IgnoreQueryFilters().AnyAsync(r => r.Id == ruleId && r.UserId == userId, cancellationToken))
        {
            return "That recurring transaction does not exist.";
        }

        if (row.FeeOfId is { } feeOf)
        {
            return await CheckFeeAsync(row, feeOf, cancellationToken);
        }

        if (row.PersonId is { } personId)
        {
            return await CheckLoanAsync(row, personId, cancellationToken);
        }

        var request = new TransactionRequest(row.Type, row.Amount, row.FromWalletId, row.ToWalletId, row.CategoryId, row.OccurredAt, row.Note, null, null);
        var (_, problem) = await TransactionRules.CheckAsync(db, userId, request, existing, null, now, cancellationToken);
        return problem is null ? null : SyncRules.ReasonOf(problem);
    }

    private async Task<string?> CheckFeeAsync(TransactionRow row, Guid feeOf, CancellationToken cancellationToken)
    {
        if (row.Type != TransactionType.Expense || row.FromWalletId is null || row.ToWalletId is not null || row.PersonId is not null)
        {
            return "A transfer fee is an expense from the transfer's wallet.";
        }

        if (!await db.Transactions.AnyAsync(
                t => t.Id == feeOf && t.UserId == userId && t.Type == TransactionType.Transfer && t.FeeOfId == null, cancellationToken))
        {
            return "That transfer does not exist.";
        }

        if (!await db.Wallets.AnyAsync(w => w.Id == row.FromWalletId && w.UserId == userId, cancellationToken))
        {
            return "That wallet does not exist.";
        }

        return row.CategoryId is { } categoryId
            && !await db.Categories.AnyAsync(c => c.Id == categoryId && c.UserId == userId && c.Kind == CategoryKind.Expense, cancellationToken)
            ? "Choose an expense category."
            : null;
    }

    /// <summary>A loan or repayment moves money between one of the user's wallets and the person's Lent or Borrowed wallet.</summary>
    private async Task<string?> CheckLoanAsync(TransactionRow row, Guid personId, CancellationToken cancellationToken)
    {
        if (row.Type != TransactionType.Transfer || row.CategoryId is not null || row.FromWalletId is null || row.ToWalletId is null)
        {
            return "A loan is a transfer between your wallet and the person, with no category.";
        }

        if (!await db.People.AnyAsync(p => p.Id == personId && p.UserId == userId, cancellationToken))
        {
            return "That person does not exist.";
        }

        var ids = new[] { row.FromWalletId.Value, row.ToWalletId.Value };
        var wallets = await db.Wallets.Where(w => w.UserId == userId && ids.Contains(w.Id)).ToListAsync(cancellationToken);
        var personSide = wallets.Count(w => w.PersonId == personId && WalletRules.IsPersonWallet(w.Type));
        var ownSide = wallets.Count(w => !WalletRules.IsPersonWallet(w.Type));
        return personSide == 1 && ownSide == 1 ? null : "Choose one of your own wallets and this person's loan.";
    }

    // Budgets

    private Task<PushResult> BudgetAsync(Guid mutationId, BudgetRow row, CancellationToken cancellationToken) =>
        UpsertAsync(
            mutationId, db.Budgets, row.Id, row.UpdatedAt, row.DeletedAt is not null,
            async _ =>
            {
                if (row.Amount <= 0 || row.Amount > TransactionRules.MaxAmount)
                {
                    return "Enter a monthly amount above zero.";
                }

                if (row.CategoryId is { } categoryId
                    && !await db.Categories.AnyAsync(c => c.Id == categoryId && c.UserId == userId && c.Kind == CategoryKind.Expense, cancellationToken))
                {
                    return "Choose one of your expense categories.";
                }

                return await db.Budgets.AnyAsync(b => b.UserId == userId && b.Id != row.Id && b.CategoryId == row.CategoryId, cancellationToken)
                    ? "That category already has a budget. Change that one instead."
                    : null;
            },
            budget =>
            {
                budget.CategoryId = row.CategoryId;
                budget.Amount = row.Amount;
            },
            Fine,
            Nothing,
            budget => SyncRules.ToRow(budget),
            cancellationToken);

    // Recurring rules

    private Task<PushResult> RecurringAsync(Guid mutationId, RecurringRuleRow row, CancellationToken cancellationToken) =>
        UpsertAsync(
            mutationId, db.RecurringRules, row.Id, row.UpdatedAt, row.DeletedAt is not null,
            async existing =>
            {
                if (row.Occurrences < 0)
                {
                    return "The count of recorded dates is zero or more.";
                }

                var request = new RecurringRequest(
                    row.Type, row.Amount, row.FromWalletId, row.ToWalletId, row.CategoryId, row.Note, row.Frequency, row.Interval,
                    row.StartDate, row.EndDate, row.AutoRecord);
                var problem = await RecurringRules.CheckAsync(db, userId, request, existing, now, cancellationToken);
                return problem is null ? null : SyncRules.ReasonOf(problem);
            },
            rule =>
            {
                rule.Type = row.Type;
                rule.Amount = row.Amount;
                rule.FromWalletId = row.FromWalletId;
                rule.ToWalletId = row.ToWalletId;
                rule.CategoryId = row.CategoryId;
                rule.Note = Text.Clean(row.Note);
                rule.Frequency = row.Frequency;
                rule.Interval = row.Interval;
                rule.StartDate = row.StartDate;
                rule.EndDate = row.EndDate;
                rule.Occurrences = row.Occurrences;
                rule.NextDate = row.NextDate;
                rule.AutoRecord = row.AutoRecord;
                rule.Paused = row.Paused;
            },
            Fine,
            Nothing,
            rule => SyncRules.ToRow(rule),
            cancellationToken);
}
