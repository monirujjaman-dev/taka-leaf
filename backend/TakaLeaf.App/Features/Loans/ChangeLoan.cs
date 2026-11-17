using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Loans;

/// <summary>
/// PUT /api/loans/{id} - name, bank, paying wallet, rate, EMI and the automatic switch (a new rate
/// or EMI applies from the next EMI). DELETE /api/loans/{id} - removes the loan, its wallet and
/// every transaction recorded for it.
/// </summary>
public static class ChangeLoan
{
    public static RouteGroupBuilder MapChangeLoan(this RouteGroupBuilder group)
    {
        group.MapPut("/{id:guid}", Update).WithName("UpdateBankLoan");
        group.MapDelete("/{id:guid}", Delete).WithName("DeleteBankLoan");
        return group;
    }

    private static async Task<IResult> Update(
        Guid id, UpdateLoanRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await LoanRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (loan is null)
        {
            return NotFound.Problem("Loan");
        }

        if (Text.LabelProblem(request.Name, LoanRules.NameMax) is { } nameProblem)
        {
            return ValidationErrors.For("name", nameProblem);
        }

        if (Text.Clean(request.Lender) is { Length: > LoanRules.NameMax })
        {
            return ValidationErrors.For("lender", $"Use at most {LoanRules.NameMax} characters.");
        }

        var card = loan.Type == LoanType.CardEmi;
        var payFrom = request.PayFromWalletId ?? loan.PayFromWalletId;
        if (await LoanRules.CheckPayWalletAsync(db, userId, payFrom, "payFromWalletId", card, loan.PayFromWalletId, cancellationToken) is { } payProblem)
        {
            return payProblem;
        }

        var rate = request.RatePoints ?? loan.RatePoints;
        if (rate < 0 || rate > LoanMath.MaxRatePoints)
        {
            return ValidationErrors.For("ratePoints", "Enter the interest rate, from 0 to 100 % a year.");
        }

        var state = (await LoanRules.StatesAsync(db, userId, [loan], cancellationToken))[loan.Id];
        var emi = request.Emi ?? loan.Emi;
        if (!state.Closed && LoanRules.CheckEmi(emi, state.Outstanding, rate) is { } emiProblem)
        {
            return emiProblem;
        }

        var name = Text.Clean(request.Name)!;
        loan.Name = name;
        loan.Lender = card ? null : Text.Clean(request.Lender);
        loan.PayFromWalletId = payFrom;
        loan.RatePoints = rate;
        loan.Emi = emi;
        loan.AutoRecord = card || (request.AutoRecord ?? loan.AutoRecord);
        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.Id == loan.WalletId, cancellationToken);
        if (wallet is not null)
        {
            wallet.Name = name;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(await LoanRules.DtoAsync(db, calendar, loan, cancellationToken));
    }

    private static async Task<IResult> Delete(Guid id, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var loan = await LoanRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (loan is null)
        {
            return NotFound.Problem("Loan");
        }

        var now = clock.GetUtcNow();
        foreach (var row in await db.Transactions.Where(t => t.UserId == userId && t.LoanId == loan.Id).ToListAsync(cancellationToken))
        {
            row.DeletedAt = now;
        }

        if (await db.Wallets.FirstOrDefaultAsync(w => w.Id == loan.WalletId, cancellationToken) is { } wallet)
        {
            wallet.DeletedAt = now;
        }

        loan.DeletedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
