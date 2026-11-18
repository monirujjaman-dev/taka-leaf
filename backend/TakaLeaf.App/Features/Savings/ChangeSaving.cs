using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Savings;

/// <summary>
/// PUT /api/savings/{id} - changes names, the account, the rate or tax (from the next payment),
/// the instalment or premium, policy details, bond numbers and the switches. DELETE removes it
/// with its wallet and every row recorded for it.
/// </summary>
public static class ChangeSaving
{
    public static RouteGroupBuilder MapChangeSaving(this RouteGroupBuilder group)
    {
        group.MapPut("/{id:guid}", Update).WithName("UpdateSaving");
        group.MapDelete("/{id:guid}", Delete).WithName("DeleteSaving");
        return group;
    }

    private static async Task<IResult> Update(
        Guid id, UpdateSavingRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var saving = await SavingRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (saving is null)
        {
            return NotFound.Problem("Saving");
        }

        if (Text.LabelProblem(request.Name, SavingRules.NameMax) is { } nameProblem)
        {
            return ValidationErrors.For("name", nameProblem);
        }

        foreach (var (field, value) in new[] { ("provider", request.Provider), ("policyNumber", request.PolicyNumber), ("insured", request.Insured), ("nominee", request.Nominee) })
        {
            if (Text.Clean(value) is { Length: > SavingRules.NameMax })
            {
                return ValidationErrors.For(field, $"Use at most {SavingRules.NameMax} characters.");
            }
        }

        var payFrom = request.PayFromWalletId ?? saving.PayFromWalletId;
        if (await SavingRules.CheckAccountAsync(db, userId, payFrom, "payFromWalletId", saving.PayFromWalletId, cancellationToken) is { } payProblem)
        {
            return payProblem;
        }

        if (request.RatePoints is < 0 or > SavingMath.MaxRatePoints)
        {
            return ValidationErrors.For("ratePoints", "Enter the profit rate, from 0 to 100 % a year.");
        }

        if (request.TaxPoints is < 0 or > SavingMath.MaxRatePoints)
        {
            return ValidationErrors.For("taxPoints", "Enter the tax at source, from 0 to 100 %.");
        }

        if (request.Amount is <= 0 or > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("amount", "Enter an amount more than zero.");
        }

        if (request.ChargesPerYear is < 0 or > TransactionRules.MaxAmount || request.MaturityAmount is <= 0 or > TransactionRules.MaxAmount
            || request.Cover is <= 0 or > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For(request.ChargesPerYear is < 0 ? "chargesPerYear" : request.MaturityAmount is <= 0 ? "maturityAmount" : "cover", "Enter an amount more than zero.");
        }

        if (request.Policy is { } policy && !Enum.IsDefined(policy))
        {
            return ValidationErrors.For("policy", "Choose life, health, car or other.");
        }

        var bonds = SavingRules.JoinBonds(request.BondNumbers);
        if (bonds is { Length: > SavingRules.BondNumbersMax })
        {
            return ValidationErrors.For("bondNumbers", "That is too many numbers to keep.");
        }

        saving.Name = Text.Clean(request.Name)!;
        saving.Provider = Text.Clean(request.Provider);
        saving.PayFromWalletId = payFrom;
        if (saving.Kind is SavingKind.Fdr or SavingKind.Dps or SavingKind.Certificate)
        {
            saving.RatePoints = request.RatePoints ?? saving.RatePoints;
        }

        if (saving.Kind != SavingKind.Insurance)
        {
            saving.TaxPoints = request.TaxPoints ?? saving.TaxPoints;
        }

        if (saving.Kind is SavingKind.Dps or SavingKind.Insurance && request.Amount is { } amount)
        {
            saving.Amount = amount;
        }

        switch (saving.Kind)
        {
            case SavingKind.Fdr:
                saving.ChargesPerYear = request.ChargesPerYear ?? saving.ChargesPerYear;
                saving.Renew = request.Renew ?? saving.Renew;
                break;
            case SavingKind.Dps:
                saving.MaturityAmount = request.MaturityAmount;
                saving.AutoRecord = request.AutoRecord ?? saving.AutoRecord;
                break;
            case SavingKind.Certificate:
                saving.AutoRecord = request.AutoRecord ?? saving.AutoRecord;
                break;
            case SavingKind.PrizeBond:
                saving.BondNumbers = request.BondNumbers is null ? saving.BondNumbers : bonds;
                break;
            case SavingKind.Insurance:
                saving.Cover = request.Cover;
                saving.Policy = request.Policy ?? saving.Policy;
                saving.PolicyNumber = Text.Clean(request.PolicyNumber);
                saving.Insured = Text.Clean(request.Insured);
                saving.Nominee = Text.Clean(request.Nominee);
                saving.Remind = request.Remind ?? saving.Remind;
                break;
        }

        if (saving.WalletId is { } walletId && await db.Wallets.FirstOrDefaultAsync(w => w.Id == walletId && w.UserId == userId, cancellationToken) is { } wallet)
        {
            wallet.Name = saving.Name;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(await SavingRules.DtoAsync(db, calendar, saving, cancellationToken));
    }

    private static async Task<IResult> Delete(Guid id, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var saving = await SavingRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (saving is null)
        {
            return NotFound.Problem("Saving");
        }

        var now = clock.GetUtcNow();
        saving.DeletedAt = now;
        foreach (var row in await db.Transactions.Where(t => t.UserId == userId && t.SavingId == saving.Id).ToListAsync(cancellationToken))
        {
            row.DeletedAt = now;
        }

        if (saving.WalletId is { } walletId && await db.Wallets.FirstOrDefaultAsync(w => w.Id == walletId && w.UserId == userId, cancellationToken) is { } wallet)
        {
            wallet.DeletedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
