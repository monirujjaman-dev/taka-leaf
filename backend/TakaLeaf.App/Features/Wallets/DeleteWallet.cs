using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Wallets;

/// <summary>
/// DELETE /api/wallets/{id} - only a wallet with no transactions can be deleted; one with
/// history is archived instead, so no past entry loses its wallet.
/// </summary>
public static class DeleteWallet
{
    public static RouteGroupBuilder MapDeleteWallet(this RouteGroupBuilder group)
    {
        group.MapDelete("/{id:guid}", Handle).WithName("DeleteWallet");
        return group;
    }

    private static async Task<IResult> Handle(
        Guid id,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var wallet = await WalletRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (wallet is null)
        {
            return NotFound.Problem("Wallet");
        }

        if (WalletRules.IsPersonWallet(wallet.Type))
        {
            return ValidationErrors.For("type", "A lent or borrowed wallet is changed from People.");
        }

        var used = await db.Transactions.AnyAsync(
            t => t.UserId == userId && (t.FromWalletId == id || t.ToWalletId == id), cancellationToken);
        if (used)
        {
            return Results.Problem(
                title: "This wallet has transactions. Archive it instead.",
                statusCode: StatusCodes.Status409Conflict);
        }

        wallet.DeletedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
