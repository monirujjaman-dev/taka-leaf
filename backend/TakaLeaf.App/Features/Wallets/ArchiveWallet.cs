using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Wallets;

/// <summary>
/// POST /api/wallets/{id}/archive and /unarchive - an archived wallet is hidden from lists and
/// pickers, but its history stays and its balance still counts in the totals.
/// </summary>
public static class ArchiveWallet
{
    public static RouteGroupBuilder MapArchiveWallet(this RouteGroupBuilder group)
    {
        group.MapPost("/{id:guid}/archive", (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken) =>
            SetArchived(id, true, principal, db, cancellationToken)).WithName("ArchiveWallet");
        group.MapPost("/{id:guid}/unarchive", (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken) =>
            SetArchived(id, false, principal, db, cancellationToken)).WithName("UnarchiveWallet");
        return group;
    }

    private static async Task<IResult> SetArchived(
        Guid id,
        bool archived,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var wallet = await WalletRules.FindOwnedAsync(db, principal.UserId(), id, cancellationToken);
        if (wallet is null)
        {
            return NotFound.Problem("Wallet");
        }

        if (wallet.Type == WalletType.Loan)
        {
            return ValidationErrors.For("type", "This wallet belongs to a loan. Change it from Loans.");
        }

        if (wallet.Type == WalletType.Savings)
        {
            return ValidationErrors.For("type", "This wallet belongs to a saving. Change it from Savings.");
        }

        if (WalletRules.IsPersonWallet(wallet.Type))
        {
            return ValidationErrors.For("type", "A lent or borrowed wallet is changed from People.");
        }

        if (wallet.Archived != archived)
        {
            wallet.Archived = archived;
            await db.SaveChangesAsync(cancellationToken);
        }

        return Results.Ok(await WalletRules.DtoAsync(db, wallet, cancellationToken));
    }
}
