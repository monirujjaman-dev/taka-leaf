using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Loans;

/// <summary>
/// POST /api/loans/{id}/pay - the next EMI. POST /api/loans/{id}/extra - a part payment, all
/// principal. POST /api/loans/{id}/settle - pays everything left plus the bank's early settlement
/// charge, and closes the loan. DELETE /api/loans/{id}/emis/last - removes the latest EMI recorded.
/// </summary>
public static class LoanPayments
{
    public static RouteGroupBuilder MapLoanPayments(this RouteGroupBuilder group)
    {
        group.MapPost("/{id:guid}/pay", Pay).WithName("PayLoanEmi");
        group.MapPost("/{id:guid}/extra", Extra).WithName("PayLoanExtra");
        group.MapPost("/{id:guid}/settle", Settle).WithName("SettleLoan");
        group.MapDelete("/{id:guid}/emis/last", UndoLast).WithName("UndoLastLoanEmi");
        return group;
    }

    private static async Task<IResult> Pay(
        Guid id, PayEmiRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await LoanRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (loan is null)
        {
            return NotFound.Problem("Loan");
        }

        var walletId = request.WalletId ?? loan.PayFromWalletId;
        if (await LoanRules.CheckPayWalletAsync(db, userId, walletId, "walletId", false, loan.PayFromWalletId, cancellationToken) is { } walletProblem)
        {
            return walletProblem;
        }

        var state = (await LoanRules.StatesAsync(db, userId, [loan], cancellationToken))[loan.Id];
        var (_, problem) = await LoanRules.AddEmiAsync(db, loan, state, walletId, request.Amount, request.LateFee ?? 0, request.OccurredAt ?? clock.GetUtcNow(), cancellationToken);
        if (problem is not null)
        {
            return problem;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Problem(title: "This EMI was just recorded elsewhere. Refresh to see it.", statusCode: StatusCodes.Status409Conflict);
        }

        return Results.Ok(await LoanRules.DtoAsync(db, calendar, loan, cancellationToken));
    }

    private static async Task<IResult> Extra(
        Guid id, PayExtraRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await LoanRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (loan is null)
        {
            return NotFound.Problem("Loan");
        }

        var walletId = request.WalletId ?? loan.PayFromWalletId;
        if (await LoanRules.CheckPayWalletAsync(db, userId, walletId, "walletId", false, loan.PayFromWalletId, cancellationToken) is { } walletProblem)
        {
            return walletProblem;
        }

        var state = (await LoanRules.StatesAsync(db, userId, [loan], cancellationToken))[loan.Id];
        if (state.Closed)
        {
            return Results.Problem(title: "This loan is paid off.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (request.Amount is not { } amount || amount <= 0)
        {
            return ValidationErrors.For("amount", "Enter the amount paid, more than zero.");
        }

        if (amount >= state.Outstanding)
        {
            return ValidationErrors.For("amount", $"Only {Money.Format(state.Outstanding)} is left. To pay it all, settle the loan.");
        }

        db.Transactions.Add(LoanRules.Row(loan, LoanPart.Principal, TransactionType.Transfer, amount, walletId, loan.WalletId, null, null,
            request.OccurredAt ?? clock.GetUtcNow(), $"{loan.Name} extra payment"));
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(await LoanRules.DtoAsync(db, calendar, loan, cancellationToken));
    }

    private static async Task<IResult> Settle(
        Guid id, SettleLoanRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await LoanRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (loan is null)
        {
            return NotFound.Problem("Loan");
        }

        var walletId = request.WalletId ?? loan.PayFromWalletId;
        if (await LoanRules.CheckPayWalletAsync(db, userId, walletId, "walletId", false, loan.PayFromWalletId, cancellationToken) is { } walletProblem)
        {
            return walletProblem;
        }

        var state = (await LoanRules.StatesAsync(db, userId, [loan], cancellationToken))[loan.Id];
        if (state.Closed)
        {
            return Results.Problem(title: "This loan is already paid off.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (request.ChargePoints is < 0 or > LoanMath.MaxRatePoints)
        {
            return ValidationErrors.For("chargePoints", "Enter the charge as 0 to 100 % of what is left.");
        }

        var charge = request.Charge ?? SettlementCharge(state.Outstanding, request.ChargePoints ?? 0);
        if (charge < 0 || charge > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("charge", "The charge must be zero or more.");
        }

        var at = request.OccurredAt ?? clock.GetUtcNow();
        db.Transactions.Add(LoanRules.Row(loan, LoanPart.Principal, TransactionType.Transfer, state.Outstanding, walletId, loan.WalletId, null, null, at, $"{loan.Name} settled"));
        if (charge > 0)
        {
            db.Transactions.Add(LoanRules.Row(loan, LoanPart.Fee, TransactionType.Expense, charge, walletId, null,
                await LoanRules.FeesCategoryAsync(db, userId, cancellationToken), null, at, LoanRules.SettlementNote));
        }

        loan.ClosedOn = calendar.DateOf(at);
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(await LoanRules.DtoAsync(db, calendar, loan, cancellationToken));
    }

    /// <summary>What is left × the charge points / 10,000, rounded half up (200 points = 2 %).</summary>
    public static long SettlementCharge(long outstanding, int chargePoints) =>
        outstanding <= 0 || chargePoints <= 0 ? 0 : (long)(((Int128)outstanding * chargePoints * 2 + 10_000) / 20_000);

    private static async Task<IResult> UndoLast(Guid id, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await LoanRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (loan is null)
        {
            return NotFound.Problem("Loan");
        }

        var last = await db.Transactions
            .Where(t => t.UserId == userId && t.LoanId == loan.Id && t.LoanEmi != null)
            .MaxAsync(t => t.LoanEmi, cancellationToken);
        if (last is null)
        {
            return Results.Problem(title: "No EMI is recorded for this loan yet.", statusCode: StatusCodes.Status400BadRequest);
        }

        var now = clock.GetUtcNow();
        foreach (var row in await db.Transactions.Where(t => t.UserId == userId && t.LoanId == loan.Id && t.LoanEmi == last).ToListAsync(cancellationToken))
        {
            row.DeletedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
