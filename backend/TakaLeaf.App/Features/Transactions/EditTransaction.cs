using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>
/// PUT /api/transactions/{id} - replaces every field of a transaction. Balances follow on their
/// own, because they are calculated from transactions. A transfer's fee row is kept in step.
/// </summary>
public static class EditTransaction
{
    public static RouteGroupBuilder MapEditTransaction(this RouteGroupBuilder group)
    {
        group.MapPut("/{id:guid}", Handle).WithName("EditTransaction");
        return group;
    }

    private static async Task<IResult> Handle(
        Guid id,
        TransactionRequest request,
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

        var fee = await db.Transactions.FirstOrDefaultAsync(t => t.UserId == userId && t.FeeOfId == id, cancellationToken);
        var now = clock.GetUtcNow();
        var (input, problem) = await TransactionRules.CheckAsync(db, userId, request, transaction, fee?.CategoryId, now, cancellationToken);
        if (problem is not null)
        {
            return problem;
        }

        TransactionRules.Apply(transaction, input!);

        if (input!.Fee > 0)
        {
            if (fee is null)
            {
                fee = new Transaction();
                db.Transactions.Add(fee);
            }

            TransactionRules.ApplyFee(fee, transaction, input);
        }
        else if (fee is not null)
        {
            fee.DeletedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok((await TransactionRules.ToDtosAsync(db, userId, [transaction], cancellationToken))[0]);
    }
}
