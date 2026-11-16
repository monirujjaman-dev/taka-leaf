using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.People;

/// <summary>
/// POST /api/people/{id}/loans, PUT and DELETE /api/people/{id}/loans/{loanId} - record, change
/// or remove money lent, borrowed or paid back. Each loan is a transfer, so it also shows in the
/// history and moves the user's wallet.
/// </summary>
public static class Loans
{
    public static RouteGroupBuilder MapLoans(this RouteGroupBuilder group)
    {
        group.MapPost("/{id:guid}/loans", Add).WithName("AddLoan");
        group.MapPut("/{id:guid}/loans/{loanId:guid}", Edit).WithName("EditLoan");
        group.MapDelete("/{id:guid}/loans/{loanId:guid}", Delete).WithName("DeleteLoan");
        return group;
    }

    private static async Task<IResult> Add(
        Guid id, LoanRequest request, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        if (await PeopleRules.FindOwnedAsync(db, userId, id, cancellationToken) is null)
        {
            return NotFound.Problem("Person");
        }

        var wallets = await PeopleRules.WalletsOfAsync(db, userId, id, cancellationToken);
        if (await PeopleRules.CheckLoanAsync(db, userId, wallets, request, null, cancellationToken) is { } problem)
        {
            return problem;
        }

        var loan = new Transaction { UserId = userId };
        PeopleRules.Apply(loan, id, wallets, request.Kind!.Value, request.Amount!.Value, request.WalletId!.Value,
            (request.OccurredAt ?? clock.GetUtcNow()).ToUniversalTime(), Text.Clean(request.Note));
        db.Transactions.Add(loan);
        await db.SaveChangesAsync(cancellationToken);

        var dto = (await PeopleRules.LoansAsync(db, userId, id, wallets, [loan], cancellationToken))[0];
        return Results.Created($"/api/people/{id}/loans/{loan.Id}", dto);
    }

    private static async Task<IResult> Edit(
        Guid id, Guid loanId, LoanRequest request, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await TransactionRules.FindOwnedAsync(db, userId, loanId, cancellationToken);
        if (loan is null || loan.PersonId != id)
        {
            return NotFound.Problem("Loan");
        }

        var wallets = await PeopleRules.WalletsOfAsync(db, userId, id, cancellationToken);
        if (await PeopleRules.CheckLoanAsync(db, userId, wallets, request, loan, cancellationToken) is { } problem)
        {
            return problem;
        }

        PeopleRules.Apply(loan, id, wallets, request.Kind!.Value, request.Amount!.Value, request.WalletId!.Value,
            (request.OccurredAt ?? loan.OccurredAt).ToUniversalTime(), Text.Clean(request.Note));
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok((await PeopleRules.LoansAsync(db, userId, id, wallets, [loan], cancellationToken))[0]);
    }

    private static async Task<IResult> Delete(
        Guid id, Guid loanId, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await TransactionRules.FindOwnedAsync(db, userId, loanId, cancellationToken);
        if (loan is null || loan.PersonId != id)
        {
            return NotFound.Problem("Loan");
        }

        loan.DeletedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
