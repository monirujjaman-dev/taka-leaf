using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.People;

/// <summary>
/// The four things that happen with a loan. Each is a transfer between one of the user's wallets
/// and the person's Lent or Borrowed wallet, so wallet balances stay right without extra work.
/// </summary>
public enum LoanKind
{
    /// <summary>The user gave money: wallet → Lent.</summary>
    Lend,

    /// <summary>The person paid the user back: Lent → wallet.</summary>
    GotBack,

    /// <summary>The user took money: Borrowed → wallet.</summary>
    Borrow,

    /// <summary>The user paid the person back: wallet → Borrowed.</summary>
    PaidBack,
}

/// <param name="OwesMe">What this person owes the user now.</param>
/// <param name="IOwe">What the user owes this person now.</param>
/// <param name="Net">OwesMe minus IOwe: positive means they owe the user overall.</param>
public sealed record PersonDto(Guid Id, string Name, string? Note, long OwesMe, long IOwe, long Net, DateTimeOffset? LastLoanAt);

public sealed record LoanDto(Guid Id, LoanKind Kind, long Amount, Guid WalletId, string? WalletName, DateTimeOffset OccurredAt, string? Note);

public sealed record PersonDetail(PersonDto Person, IReadOnlyList<LoanDto> Loans);

public sealed record PeopleList(IReadOnlyList<PersonDto> People, long OwedToMe, long IOwe);

public sealed record PersonRequest(string? Name, string? Note);

public sealed record LoanRequest(LoanKind? Kind, long? Amount, Guid? WalletId, DateTimeOffset? OccurredAt, string? Note);

/// <summary>A person's two loan wallets, made together with the person.</summary>
internal sealed record LoanWallets(Wallet Lent, Wallet Borrowed);

internal static class PeopleRules
{
    public const int NameMax = 80;
    public const int NoteMax = 500;

    public static string LentName(string person) => $"Lent to {person}";

    public static string BorrowedName(string person) => $"Borrowed from {person}";

    public static Task<Person?> FindOwnedAsync(AppDbContext db, Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.People.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId, cancellationToken);

    public static async Task<LoanWallets> WalletsOfAsync(AppDbContext db, Guid userId, Guid personId, CancellationToken cancellationToken)
    {
        var wallets = await db.Wallets.Where(w => w.UserId == userId && w.PersonId == personId).ToListAsync(cancellationToken);
        return new LoanWallets(wallets.Single(w => w.Type == WalletType.Lent), wallets.Single(w => w.Type == WalletType.Borrowed));
    }

    /// <summary>Checks name and note; the name must not match another person's, ignoring case.</summary>
    public static async Task<(string? Name, string? Note, IResult? Problem)> CheckAsync(
        AppDbContext db, Guid userId, Guid? personId, PersonRequest request, CancellationToken cancellationToken)
    {
        var name = Text.Clean(request.Name);
        var note = Text.Clean(request.Note);
        if (name is null)
        {
            return (null, null, ValidationErrors.For("name", "Enter the person's name."));
        }

        if (name.Length > NameMax)
        {
            return (null, null, ValidationErrors.For("name", $"Use at most {NameMax} characters."));
        }

        if (note is { Length: > NoteMax })
        {
            return (null, null, ValidationErrors.For("note", $"Keep the note to {NoteMax} characters."));
        }

        var lower = name.ToLowerInvariant();
        var taken = await db.People.AnyAsync(
            p => p.UserId == userId && p.Id != personId && p.Name.ToLower() == lower, cancellationToken);
        return taken
            ? (null, null, ValidationErrors.For("name", $"{name} is already in your people."))
            : (name, note, null);
    }

    public static PersonDto ToDto(Person person, LoanWallets wallets, IReadOnlyDictionary<Guid, long> movements, DateTimeOffset? lastLoanAt)
    {
        var lent = wallets.Lent.OpeningBalance + movements.GetValueOrDefault(wallets.Lent.Id);
        var borrowed = wallets.Borrowed.OpeningBalance + movements.GetValueOrDefault(wallets.Borrowed.Id);
        var owesMe = Math.Max(lent, 0);
        var iOwe = Math.Max(-borrowed, 0);
        return new PersonDto(person.Id, person.Name, person.Note, owesMe, iOwe, owesMe - iOwe, lastLoanAt);
    }

    public static LoanKind KindOf(Transaction transaction, LoanWallets wallets) =>
        transaction.ToWalletId == wallets.Lent.Id ? LoanKind.Lend
        : transaction.FromWalletId == wallets.Lent.Id ? LoanKind.GotBack
        : transaction.FromWalletId == wallets.Borrowed.Id ? LoanKind.Borrow
        : LoanKind.PaidBack;

    /// <summary>The user's own wallet on a loan: the end that is not the person's wallet.</summary>
    public static Guid OwnWalletOf(Transaction transaction, LoanWallets wallets) =>
        transaction.FromWalletId is { } from && from != wallets.Lent.Id && from != wallets.Borrowed.Id ? from : transaction.ToWalletId!.Value;

    public static void Apply(Transaction transaction, Guid personId, LoanWallets wallets, LoanKind kind, long amount, Guid walletId, DateTimeOffset occurredAt, string? note)
    {
        transaction.Type = TransactionType.Transfer;
        transaction.PersonId = personId;
        transaction.Amount = amount;
        transaction.CategoryId = null;
        transaction.OccurredAt = occurredAt;
        transaction.Note = note;
        (transaction.FromWalletId, transaction.ToWalletId) = kind switch
        {
            LoanKind.Lend => (walletId, wallets.Lent.Id),
            LoanKind.GotBack => (wallets.Lent.Id, walletId),
            LoanKind.Borrow => (wallets.Borrowed.Id, walletId),
            _ => ((Guid?)walletId, (Guid?)wallets.Borrowed.Id),
        };
    }

    /// <summary>
    /// Checks a loan. A repayment cannot be more than what is owed (counting the loan being
    /// edited as not there), so a person's balance never flips to the wrong side.
    /// </summary>
    public static async Task<IResult?> CheckLoanAsync(
        AppDbContext db,
        Guid userId,
        LoanWallets wallets,
        LoanRequest request,
        Transaction? existing,
        CancellationToken cancellationToken)
    {
        if (request.Kind is not { } kind || !Enum.IsDefined(kind))
        {
            return ValidationErrors.For("kind", "Choose Lend, GotBack, Borrow or PaidBack.");
        }

        if (request.Amount is not { } amount || amount <= 0 || amount > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("amount", "Enter an amount above zero.");
        }

        if (request.WalletId is not { } walletId)
        {
            return ValidationErrors.For("walletId", kind is LoanKind.Lend or LoanKind.PaidBack
                ? "Choose the wallet the money left."
                : "Choose the wallet the money went to.");
        }

        var current = existing is null ? (Guid?)null : OwnWalletOf(existing, wallets);
        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.Id == walletId && w.UserId == userId, cancellationToken);
        if (wallet is null)
        {
            return ValidationErrors.For("walletId", "That wallet does not exist.");
        }

        if (WalletRulesForLoans.IsPersonWallet(wallet))
        {
            return ValidationErrors.For("walletId", "Choose one of your own wallets, like Cash or bKash.");
        }

        if (wallet.Archived && walletId != current)
        {
            return ValidationErrors.For("walletId", "That wallet is archived. Unarchive it to use it.");
        }

        if (Text.Clean(request.Note) is { Length: > NoteMax })
        {
            return ValidationErrors.For("note", $"Keep the note to {NoteMax} characters.");
        }

        if (kind is LoanKind.GotBack or LoanKind.PaidBack)
        {
            var movements = await Balances.MovementsAsync(db, userId, cancellationToken);
            var lent = wallets.Lent.OpeningBalance + movements.GetValueOrDefault(wallets.Lent.Id);
            var borrowed = wallets.Borrowed.OpeningBalance + movements.GetValueOrDefault(wallets.Borrowed.Id);
            if (existing is not null)
            {
                // Take the loan being edited out, as if it had never been recorded.
                lent += Effect(existing, wallets.Lent.Id);
                borrowed += Effect(existing, wallets.Borrowed.Id);
            }

            var outstanding = kind == LoanKind.GotBack ? Math.Max(lent, 0) : Math.Max(-borrowed, 0);
            if (amount > outstanding)
            {
                return ValidationErrors.For("amount", outstanding == 0
                    ? (kind == LoanKind.GotBack ? "Nothing is owed to you by this person." : "You owe this person nothing.")
                    : $"Only {Money.Format(outstanding)} is owed. Record anything extra as a new loan.");
            }
        }

        return null;
    }

    /// <summary>What removing this transaction would add to the wallet's balance.</summary>
    private static long Effect(Transaction transaction, Guid walletId) =>
        (transaction.FromWalletId == walletId ? transaction.Amount : 0) - (transaction.ToWalletId == walletId ? transaction.Amount : 0);

    public static async Task<IReadOnlyList<LoanDto>> LoansAsync(
        AppDbContext db, Guid userId, Guid personId, LoanWallets wallets, IEnumerable<Transaction>? only, CancellationToken cancellationToken)
    {
        var rows = only?.ToList() ?? await db.Transactions
            .Where(t => t.UserId == userId && t.PersonId == personId)
            .OrderByDescending(t => t.OccurredAt)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);
        var walletIds = rows.Select(t => OwnWalletOf(t, wallets)).Distinct().ToList();
        var names = await db.Wallets.IgnoreQueryFilters()
            .Where(w => w.UserId == userId && walletIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
        return rows.Select(t =>
        {
            var own = OwnWalletOf(t, wallets);
            return new LoanDto(t.Id, KindOf(t, wallets), t.Amount, own, names.GetValueOrDefault(own), t.OccurredAt, t.Note);
        }).ToList();
    }
}

internal static class WalletRulesForLoans
{
    public static bool IsPersonWallet(Wallet wallet) => wallet.PersonId is not null || wallet.Type is WalletType.Lent or WalletType.Borrowed;
}
