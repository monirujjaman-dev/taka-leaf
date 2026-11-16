using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>POST /api/transactions - records an income, an expense, or a transfer (with an optional fee).</summary>
public static class AddTransaction
{
    public static RouteGroupBuilder MapAddTransaction(this RouteGroupBuilder group)
    {
        group.MapPost("/", Handle).WithName("AddTransaction");
        return group;
    }

    private static async Task<IResult> Handle(
        TransactionRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var (input, problem) = await TransactionRules.CheckAsync(db, userId, request, null, null, clock.GetUtcNow(), cancellationToken);
        if (problem is not null)
        {
            return problem;
        }

        var transaction = new Transaction { UserId = userId };
        TransactionRules.Apply(transaction, input!);
        db.Transactions.Add(transaction);

        if (input!.Fee > 0)
        {
            var fee = new Transaction();
            TransactionRules.ApplyFee(fee, transaction, input);
            db.Transactions.Add(fee);
        }

        await db.SaveChangesAsync(cancellationToken);

        var dto = (await TransactionRules.ToDtosAsync(db, userId, [transaction], cancellationToken))[0];
        return Results.Created($"/api/transactions/{transaction.Id}", dto);
    }
}
