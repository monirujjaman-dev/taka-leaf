using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>GET /api/transactions/{id} - one transaction.</summary>
public static class GetTransaction
{
    public static RouteGroupBuilder MapGetTransaction(this RouteGroupBuilder group)
    {
        group.MapGet("/{id:guid}", Handle).WithName("GetTransaction");
        return group;
    }

    private static async Task<IResult> Handle(Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var transaction = await TransactionRules.FindOwnedAsync(db, userId, id, cancellationToken);
        return transaction is null
            ? NotFound.Problem("Transaction")
            : Results.Ok((await TransactionRules.ToDtosAsync(db, userId, [transaction], cancellationToken))[0]);
    }
}
