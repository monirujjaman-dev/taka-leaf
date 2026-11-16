using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>DELETE /api/transactions/{id} - removes a transaction, and a transfer's fee with it.</summary>
public static class DeleteTransaction
{
    public static RouteGroupBuilder MapDeleteTransaction(this RouteGroupBuilder group)
    {
        group.MapDelete("/{id:guid}", Handle).WithName("DeleteTransaction");
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
        var transaction = await TransactionRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (transaction is null)
        {
            return NotFound.Problem("Transaction");
        }

        if (TransactionRules.ManagedElsewhere(transaction) is { } elsewhere)
        {
            return elsewhere;
        }

        var now = clock.GetUtcNow();
        transaction.DeletedAt = now;
        var fee = await db.Transactions.FirstOrDefaultAsync(t => t.UserId == userId && t.FeeOfId == id, cancellationToken);
        if (fee is not null)
        {
            fee.DeletedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
