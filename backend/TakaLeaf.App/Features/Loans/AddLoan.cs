using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Loans;

/// <summary>
/// POST /api/loans - adds a bank loan or card EMI with its own Loan wallet. A new bank loan's money
/// arrives in a wallet (or goes straight to a seller); a loan already running starts from what is
/// left today; a new card EMI records the purchase as an expense. A processing fee is an expense.
/// </summary>
public static class AddLoan
{
    public static RouteGroupBuilder MapAddLoan(this RouteGroupBuilder group)
    {
        group.MapPost("/", Handle).WithName("AddLoan");
        return group;
    }

    private static async Task<IResult> Handle(
        AddLoanRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        if (request.Type is not { } type || !Enum.IsDefined(type))
        {
            return ValidationErrors.For("type", "Choose a bank loan or a credit card EMI.");
        }

        var card = type == LoanType.CardEmi;
        if (Text.LabelProblem(request.Name, LoanRules.NameMax) is { } nameProblem)
        {
            return ValidationErrors.For("name", nameProblem);
        }

        if (Text.Clean(request.Lender) is { Length: > LoanRules.NameMax })
        {
            return ValidationErrors.For("lender", $"Use at most {LoanRules.NameMax} characters.");
        }

        if (request.Principal is not { } amount || amount <= 0 || amount > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("principal", card ? "Enter the price, more than zero." : "Enter the loan amount, more than zero.");
        }

        if (request.RatePoints is not { } rate || rate < 0 || rate > LoanMath.MaxRatePoints)
        {
            return ValidationErrors.For("ratePoints", "Enter the interest rate, from 0 to 100 % a year.");
        }

        if (request.Months is not { } months || months < 1 || months > LoanMath.MaxMonths)
        {
            return ValidationErrors.For("months", $"Enter the months, from 1 to {LoanMath.MaxMonths}.");
        }

        if (request.FirstDueDate is not { } firstDue)
        {
            return ValidationErrors.For("firstDueDate", card ? "Choose the first statement date." : "Choose the date of the first EMI.");
        }

        var paidBefore = request.PaidBefore ?? 0;
        if (paidBefore < 0 || paidBefore >= months)
        {
            return ValidationErrors.For("paidBefore", $"Enter how many EMIs are already paid, from 0 to {months - 1}.");
        }

        var emi = request.Emi ?? LoanMath.EmiFor(amount, rate, months);
        if (LoanRules.CheckEmi(emi, amount, rate) is { } emiProblem)
        {
            return emiProblem;
        }

        if (await LoanRules.CheckPayWalletAsync(db, userId, request.PayFromWalletId, "payFromWalletId", card, null, cancellationToken) is { } payProblem)
        {
            return payProblem;
        }

        var fee = request.ProcessingFee ?? 0;
        if (fee < 0 || fee > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("processingFee", "The processing fee must be zero or more.");
        }

        Guid? receivedIn = null;
        if (!card && paidBefore == 0 && request.ReceivedInWalletId is { } received)
        {
            if (await LoanRules.CheckPayWalletAsync(db, userId, received, "receivedInWalletId", false, null, cancellationToken) is { } receivedProblem)
            {
                return receivedProblem;
            }

            receivedIn = received;
        }

        Guid? purchaseCategory = null;
        if (card && request.PurchaseCategoryId is { } categoryId)
        {
            if (!await db.Categories.AnyAsync(c => c.Id == categoryId && c.UserId == userId && c.Kind == CategoryKind.Expense && !c.Archived, cancellationToken))
            {
                return ValidationErrors.For("purchaseCategoryId", "Choose one of your expense categories.");
            }

            purchaseCategory = categoryId;
        }

        var name = Text.Clean(request.Name)!;
        var payFrom = request.PayFromWalletId!.Value;
        var wallet = new Wallet { UserId = userId, Type = WalletType.Loan, Name = name };
        var loan = new Loan
        {
            UserId = userId,
            Type = type,
            Name = name,
            Lender = card ? null : Text.Clean(request.Lender),
            WalletId = wallet.Id,
            PayFromWalletId = payFrom,
            Principal = amount,
            RatePoints = rate,
            Months = months,
            Emi = emi,
            FirstDueDate = firstDue,
            PaidBefore = paidBefore,
            AutoRecord = card || (request.AutoRecord ?? false),
        };

        // The day the loan began: a month before the first EMI, but never in the future.
        var start = calendar.StartOf(firstDue.AddMonths(-1)) + TimeSpan.FromHours(9);
        if (start > clock.GetUtcNow())
        {
            start = clock.GetUtcNow();
        }

        var rows = new List<Transaction>();
        if (paidBefore > 0)
        {
            wallet.OpeningBalance = -LoanMath.BalanceAfter(amount, rate, emi, paidBefore);
        }
        else if (card)
        {
            rows.Add(LoanRules.Row(loan, LoanPart.Purchase, TransactionType.Expense, amount, wallet.Id, null, purchaseCategory, null, start, name));
        }
        else if (receivedIn is { } into)
        {
            rows.Add(LoanRules.Row(loan, LoanPart.Disbursement, TransactionType.Transfer, amount, wallet.Id, into, null, null, start, $"{name} received"));
        }
        else
        {
            wallet.OpeningBalance = -amount;
        }

        if (fee > 0 && paidBefore == 0)
        {
            rows.Add(LoanRules.Row(loan, LoanPart.Fee, TransactionType.Expense, fee, receivedIn ?? payFrom, null,
                await LoanRules.FeesCategoryAsync(db, userId, cancellationToken), null, start, LoanRules.ProcessingFeeNote));
        }

        db.Wallets.Add(wallet);
        db.Loans.Add(loan);
        db.Transactions.AddRange(rows);
        await db.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/loans/{loan.Id}", await LoanRules.DtoAsync(db, calendar, loan, cancellationToken));
    }
}
