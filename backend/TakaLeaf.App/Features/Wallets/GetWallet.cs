using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Wallets;

/// <summary>GET /api/wallets/{id} - one wallet with its balance.</summary>
public static class GetWallet
{
    public static RouteGroupBuilder MapGetWallet(this RouteGroupBuilder group)
    {
        group.MapGet("/{id:guid}", Handle).WithName("GetWallet");
        return group;
    }

    private static async Task<IResult> Handle(Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken)
    {
        var wallet = await WalletRules.FindOwnedAsync(db, principal.UserId(), id, cancellationToken);
        if (wallet is null)
        {
            return NotFound.Problem("Wallet");
        }

        return Results.Ok(WalletRules.ToDto(wallet, await WalletRules.BalanceOfAsync(db, wallet, cancellationToken)));
    }
}
