using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Wallets;

/// <summary>A wallet as the API returns it. Every amount is in poisha.</summary>
public sealed record WalletDto(
    Guid Id,
    WalletType Type,
    string Name,
    long OpeningBalance,
    long Balance,
    long? CreditLimit,
    long? AvailableCredit,
    Guid? PersonId,
    string? Icon,
    string? Color,
    bool Archived,
    bool ExcludedFromTotal,
    int SortOrder);

/// <summary>Assets are positive balances, liabilities are negative ones; Net is assets minus liabilities.</summary>
public sealed record WalletTotals(long Assets, long Liabilities, long Net);

public sealed record WalletList(IReadOnlyList<WalletDto> Wallets, WalletTotals Totals);

internal static class WalletRules
{
    public const int NameMax = 80;
    public const int IconMax = 40;
    public const int ColorMax = 20;

    public static WalletDto ToDto(Wallet wallet, long movement)
    {
        var balance = wallet.OpeningBalance + movement;
        long? available = wallet.Type == WalletType.CreditCard && wallet.CreditLimit is { } limit ? limit + balance : null;
        return new WalletDto(
            wallet.Id, wallet.Type, wallet.Name, wallet.OpeningBalance, balance, wallet.CreditLimit, available,
            wallet.PersonId, wallet.Icon, wallet.Color, wallet.Archived, wallet.ExcludedFromTotal, wallet.SortOrder);
    }

    /// <summary>Lent and borrowed wallets belong to a person and are managed from People.</summary>
    public static bool IsPersonWallet(WalletType type) => type is WalletType.Lent or WalletType.Borrowed;

    public static Task<Wallet?> FindOwnedAsync(AppDbContext db, Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Wallets.FirstOrDefaultAsync(w => w.Id == id && w.UserId == userId, cancellationToken);

    public static async Task<long> BalanceOfAsync(AppDbContext db, Wallet wallet, CancellationToken cancellationToken)
    {
        var movements = await Balances.MovementsAsync(db, wallet.UserId, cancellationToken);
        return movements.GetValueOrDefault(wallet.Id);
    }

    /// <summary>Checks the fields a person types; returns the 400 response, or null when all is well.</summary>
    public static async Task<IResult?> CheckFieldsAsync(
        AppDbContext db,
        Guid userId,
        Guid? walletId,
        WalletType type,
        string? name,
        long? creditLimit,
        string? icon,
        string? color,
        CancellationToken cancellationToken)
    {
        if (name is null || name.Length > NameMax)
        {
            return ValidationErrors.For("name", $"Give the wallet a name of up to {NameMax} characters.");
        }

        if (creditLimit is { } limit)
        {
            if (type != WalletType.CreditCard)
            {
                return ValidationErrors.For("creditLimit", "Only a credit card has a credit limit.");
            }

            if (limit <= 0)
            {
                return ValidationErrors.For("creditLimit", "The credit limit must be more than zero.");
            }
        }

        if (Text.LabelProblem(icon, IconMax) is { } iconProblem)
        {
            return ValidationErrors.For("icon", iconProblem);
        }

        if (Text.LabelProblem(color, ColorMax) is { } colorProblem)
        {
            return ValidationErrors.For("color", colorProblem);
        }

        var lowered = name.ToLowerInvariant();
        var taken = await db.Wallets.AnyAsync(
            w => w.UserId == userId && w.Id != walletId && w.Name.ToLower() == lowered,
            cancellationToken);
        return taken ? ValidationErrors.For("name", "You already have a wallet with this name.") : null;
    }
}
