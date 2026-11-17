using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Wallets;

/// <summary>
/// PUT /api/wallets/{id} - renames a wallet or changes its opening balance, limit, look or order.
/// The type cannot change. Fields left out of SortOrder keep their value.
/// </summary>
public static class UpdateWallet
{
    public sealed record UpdateWalletRequest(
        string? Name,
        long? OpeningBalance,
        long? CreditLimit,
        string? Icon,
        string? Color,
        bool? ExcludedFromTotal,
        int? SortOrder);

    public static RouteGroupBuilder MapUpdateWallet(this RouteGroupBuilder group)
    {
        group.MapPut("/{id:guid}", Handle).WithName("UpdateWallet");
        return group;
    }

    private static async Task<IResult> Handle(
        Guid id,
        UpdateWalletRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var wallet = await WalletRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (wallet is null)
        {
            return NotFound.Problem("Wallet");
        }

        if (wallet.Type == WalletType.Loan)
        {
            return ValidationErrors.For("type", "This wallet belongs to a loan. Change it from Loans.");
        }

        if (WalletRules.IsPersonWallet(wallet.Type))
        {
            return ValidationErrors.For("type", "A lent or borrowed wallet is changed from People.");
        }

        var name = Text.Clean(request.Name);
        var icon = Text.Clean(request.Icon);
        var color = Text.Clean(request.Color);
        if (await WalletRules.CheckFieldsAsync(db, userId, wallet.Id, wallet.Type, name, request.CreditLimit, icon, color, cancellationToken) is { } problem)
        {
            return problem;
        }

        wallet.Name = name!;
        wallet.OpeningBalance = request.OpeningBalance ?? wallet.OpeningBalance;
        wallet.CreditLimit = request.CreditLimit;
        wallet.Icon = icon;
        wallet.Color = color;
        wallet.ExcludedFromTotal = request.ExcludedFromTotal ?? wallet.ExcludedFromTotal;
        wallet.SortOrder = request.SortOrder ?? wallet.SortOrder;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(await WalletRules.DtoAsync(db, wallet, cancellationToken));
    }
}
