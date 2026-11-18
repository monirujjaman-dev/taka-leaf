using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Savings;

/// <summary>
/// Money for a saving or policy, each POST /api/savings/{id}/…: deposit (the next DPS instalment,
/// or more bonds), skip (a missed DPS instalment), profit (a payment before maturity), close (at
/// maturity or early: what was paid out), renew (an FDR's new term), prize, sell (bonds back),
/// premium, payout (a claim or the policy's maturity). DELETE …/last removes the latest numbered entry.
/// </summary>
public static class SavingActions
{
    public static RouteGroupBuilder MapSavingActions(this RouteGroupBuilder group)
    {
        group.MapPost("/{id:guid}/deposit", Deposit).WithName("SavingDeposit");
        group.MapPost("/{id:guid}/skip", Skip).WithName("SavingSkip");
        group.MapPost("/{id:guid}/profit", Profit).WithName("SavingProfit");
        group.MapPost("/{id:guid}/close", Close).WithName("CloseSaving");
        group.MapPost("/{id:guid}/renew", Renew).WithName("RenewSaving");
        group.MapPost("/{id:guid}/prize", Prize).WithName("SavingPrize");
        group.MapPost("/{id:guid}/sell", Sell).WithName("SellBonds");
        group.MapPost("/{id:guid}/premium", Premium).WithName("PayPremium");
        group.MapPost("/{id:guid}/payout", Payout).WithName("PolicyPayout");
        group.MapDelete("/{id:guid}/last", UndoLast).WithName("UndoLastSavingEntry");
        return group;
    }

    private static IResult Refused(string title) => Results.Problem(title: title, statusCode: StatusCodes.Status400BadRequest);

    private sealed record Context(Saving Saving, SavingState State, Guid WalletId, DateTimeOffset At, DateOnly Day);

    /// <summary>Finds the user's saving of the right kind, checks the account and works out where it stands.</summary>
    private static async Task<(Context? Value, IResult? Problem)> LoadAsync(
        AppDbContext db, LocalCalendar calendar, TimeProvider clock, ClaimsPrincipal principal, Guid id, Guid? walletId, DateTimeOffset? occurredAt,
        SavingKind[] kinds, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var saving = await SavingRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (saving is null)
        {
            return (null, NotFound.Problem("Saving"));
        }

        if (!kinds.Contains(saving.Kind))
        {
            return (null, Refused("That does not apply to this kind of saving."));
        }

        if (saving.ClosedOn is not null)
        {
            return (null, Refused("This is already closed."));
        }

        var account = walletId ?? saving.PayFromWalletId;
        if (await SavingRules.CheckAccountAsync(db, userId, account, "walletId", saving.PayFromWalletId, cancellationToken) is { } problem)
        {
            return (null, problem);
        }

        var state = (await SavingRules.StatesAsync(db, calendar, userId, [saving], cancellationToken))[saving.Id];
        var at = occurredAt ?? clock.GetUtcNow();
        return (new Context(saving, state, account, at, calendar.DateOf(at)), null);
    }

    private static async Task<IResult> SaveAsync(AppDbContext db, LocalCalendar calendar, Saving saving, CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Problem(title: "This was just recorded elsewhere. Refresh to see it.", statusCode: StatusCodes.Status409Conflict);
        }

        return Results.Ok(await SavingRules.DtoAsync(db, calendar, saving, cancellationToken));
    }

    private static async Task<IResult> Deposit(
        Guid id, DepositRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, request.WalletId, request.OccurredAt, [SavingKind.Dps, SavingKind.PrizeBond], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        var s = c.Saving;
        if (s.Kind == SavingKind.Dps)
        {
            if (c.State.Next is not { Number: { } n } next || next.Action == "Close")
            {
                return Refused("Every instalment is recorded. Close the DPS to record what the bank paid.");
            }

            db.Transactions.Add(SavingRules.Row(s, SavingPart.Deposit, TransactionType.Transfer, s.Amount, c.WalletId, s.WalletId, null, n, c.At, $"{s.Name} instalment {n}"));
            return await SaveAsync(db, calendar, s, cancellationToken);
        }

        if (request.BondCount is not { } count || count < 1 || count > 100_000)
        {
            return ValidationErrors.For("bondCount", "Enter how many ৳100 bonds, 1 or more.");
        }

        var bonds = SavingRules.JoinBonds(SavingRules.BondsOf(s).Concat(request.BondNumbers ?? []));
        if (bonds is { Length: > SavingRules.BondNumbersMax })
        {
            return ValidationErrors.For("bondNumbers", "That is too many numbers to keep.");
        }

        s.BondNumbers = bonds;
        db.Transactions.Add(SavingRules.Row(s, SavingPart.Deposit, TransactionType.Transfer, count * SavingMath.BondValue, c.WalletId, s.WalletId, null, null, c.At, $"{count} prize bonds"));
        return await SaveAsync(db, calendar, s, cancellationToken);
    }

    private static async Task<IResult> Skip(Guid id, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, null, null, [SavingKind.Dps], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        if (c.State.Next is not { Number: { } n })
        {
            return Refused("There is no instalment left to mark.");
        }

        c.Saving.Missed = string.Join(',', c.State.Missed.Append(n).Order());
        return await SaveAsync(db, calendar, c.Saving, cancellationToken);
    }

    private static async Task<IResult> Profit(
        Guid id, ProfitRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, request.WalletId, request.OccurredAt, [SavingKind.Fdr, SavingKind.Certificate], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        var s = c.Saving;
        if (s.EveryMonths == 0 || c.State.ProfitDone >= SavingRules.Periods(s) - 1)
        {
            return Refused("The next profit comes at maturity. Close it then to record what was paid.");
        }

        var gross = request.Profit ?? SavingRules.PeriodProfit(s);
        var tax = request.Tax ?? SavingMath.Tax(gross, s.TaxPoints);
        if (gross <= 0 || gross > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("profit", "Enter the profit before tax, more than zero.");
        }

        if (tax < 0 || tax >= gross)
        {
            return ValidationErrors.For("tax", "The tax must be zero or more, and less than the profit.");
        }

        await SavingRules.AddProfitAsync(db, s, c.WalletId, gross, tax, s.SeqBase + c.State.ProfitDone + 1, c.At, cancellationToken);
        return await SaveAsync(db, calendar, s, cancellationToken);
    }

    private static async Task<IResult> Close(
        Guid id, CloseSavingRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, request.WalletId, request.OccurredAt,
            [SavingKind.Fdr, SavingKind.Dps, SavingKind.Certificate], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        var s = c.Saving;
        var matured = c.State.MaturesOn is { } due && c.Day >= due;
        long received, tax, charges;
        int? seq = null;
        if (request.Received is { } paid)
        {
            if (paid < 0 || paid > TransactionRules.MaxAmount)
            {
                return ValidationErrors.For("received", "Enter what reached your account, zero or more.");
            }

            received = paid;
            tax = request.Tax ?? 0;
            charges = request.Charges ?? 0;
        }
        else if (matured)
        {
            (received, tax, charges) = Expected(s, c.State.Balance);
        }
        else
        {
            return ValidationErrors.For("received", "Enter what the bank paid you.");
        }

        if (tax < 0 || charges < 0 || tax > TransactionRules.MaxAmount || charges > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For(tax < 0 ? "tax" : "charges", "Enter zero or more.");
        }

        if (matured && s.Kind != SavingKind.Dps)
        {
            seq = s.SeqBase + SavingRules.Periods(s);
        }

        await SavingRules.AddCloseAsync(db, s, c.State.Balance, c.WalletId, received, tax, charges, seq, c.At, c.Day, cancellationToken);
        return await SaveAsync(db, calendar, s, cancellationToken);
    }

    /// <summary>What a saving is expected to pay at maturity: the amount reaching the account, the tax and the charges.</summary>
    internal static (long Received, long Tax, long Charges) Expected(Saving s, long balance)
    {
        if (s.Kind == SavingKind.Dps)
        {
            var maturity = s.MaturityAmount ?? SavingMath.DpsMaturity(s.Amount, s.RatePoints, Math.Max(s.Months - SavingRules.MissedOf(s).Count, 0));
            var profit = Math.Max(maturity - balance, 0);
            var dpsTax = SavingMath.Tax(profit, s.TaxPoints);
            return (balance + profit - dpsTax, dpsTax, 0);
        }

        var gross = SavingRules.PeriodProfit(s);
        var tax = SavingMath.Tax(gross, s.TaxPoints);
        var charges = s.Kind == SavingKind.Fdr ? SavingMath.Excise(s.ChargesPerYear, s.Months) : 0;
        return (balance + gross - tax - charges, tax, charges);
    }

    private static async Task<IResult> Renew(
        Guid id, RenewRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, null, request.OccurredAt, [SavingKind.Fdr], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        var due = c.State.MaturesOn ?? DateOnly.MaxValue;
        if (c.Day < due)
        {
            return Refused($"It renews on its maturity date, {due.ToString("d MMM yyyy", System.Globalization.CultureInfo.InvariantCulture)}.");
        }

        if (request.RatePoints is < 0 or > SavingMath.MaxRatePoints)
        {
            return ValidationErrors.For("ratePoints", "Enter the profit rate, from 0 to 100 % a year.");
        }

        await SavingRules.AddRenewAsync(db, c.Saving, c.State.Balance, request.RatePoints, c.At, cancellationToken);
        return await SaveAsync(db, calendar, c.Saving, cancellationToken);
    }

    private static async Task<IResult> Prize(
        Guid id, PrizeRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, request.WalletId, request.OccurredAt, [SavingKind.PrizeBond], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        if (request.Prize is not { } prize || prize <= 0 || prize > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("prize", "Enter the prize, more than zero.");
        }

        var points = request.TaxPoints ?? c.Saving.TaxPoints;
        if (points is < 0 or > SavingMath.MaxRatePoints)
        {
            return ValidationErrors.For("taxPoints", "Enter the tax, from 0 to 100 %.");
        }

        if (Text.Clean(request.Bond) is { Length: > SavingRules.NameMax })
        {
            return ValidationErrors.For("bond", $"Use at most {SavingRules.NameMax} characters.");
        }

        var s = c.Saving;
        var note = Text.Clean(request.Bond) is { } bond ? $"Prize bond {bond}" : "Prize bond prize";
        db.Transactions.Add(SavingRules.Row(s, SavingPart.Prize, TransactionType.Income, prize, null, c.WalletId,
            await SavingRules.CategoryAsync(db, s.UserId, SavingPart.Prize, null, cancellationToken), null, c.At, note));
        var tax = SavingMath.Tax(prize, points);
        if (tax > 0)
        {
            db.Transactions.Add(SavingRules.Row(s, SavingPart.Tax, TransactionType.Expense, tax, c.WalletId, null,
                await SavingRules.CategoryAsync(db, s.UserId, SavingPart.Tax, null, cancellationToken), null, c.At, "Prize bond tax at source"));
        }

        return await SaveAsync(db, calendar, s, cancellationToken);
    }

    private static async Task<IResult> Sell(
        Guid id, SellBondsRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, request.WalletId, request.OccurredAt, [SavingKind.PrizeBond], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        if (request.BondCount is not { } count || count < 1 || count > c.State.BondCount)
        {
            return ValidationErrors.For("bondCount", $"Enter how many to sell back, from 1 to {c.State.BondCount}.");
        }

        var s = c.Saving;
        db.Transactions.Add(SavingRules.Row(s, SavingPart.Withdrawal, TransactionType.Transfer, count * SavingMath.BondValue, s.WalletId, c.WalletId, null, null, c.At, $"{count} prize bonds sold back"));
        if (count == c.State.BondCount)
        {
            s.ClosedOn = c.Day;
        }

        return await SaveAsync(db, calendar, s, cancellationToken);
    }

    private static async Task<IResult> Premium(
        Guid id, PremiumRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, request.WalletId, request.OccurredAt, [SavingKind.Insurance], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        if (c.State.Next is not { Number: { } n })
        {
            return Refused("Every premium of this policy is paid.");
        }

        var amount = request.Amount ?? c.Saving.Amount;
        if (amount <= 0 || amount > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("amount", "Enter the premium, more than zero.");
        }

        var s = c.Saving;
        db.Transactions.Add(SavingRules.Row(s, SavingPart.Premium, TransactionType.Expense, amount, c.WalletId, null,
            await SavingRules.CategoryAsync(db, s.UserId, SavingPart.Premium, s.Policy, cancellationToken), n, c.At, $"{s.Name} premium {n}"));
        return await SaveAsync(db, calendar, s, cancellationToken);
    }

    private static async Task<IResult> Payout(
        Guid id, PayoutRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var (c, problem) = await LoadAsync(db, calendar, clock, principal, id, request.WalletId, request.OccurredAt, [SavingKind.Insurance], cancellationToken);
        if (c is null)
        {
            return problem!;
        }

        if (request.Kind is not ("Claim" or "Maturity"))
        {
            return ValidationErrors.For("kind", "Choose a claim or the maturity amount.");
        }

        if (request.Amount is not { } amount || amount <= 0 || amount > TransactionRules.MaxAmount)
        {
            return ValidationErrors.For("amount", "Enter the amount paid to you, more than zero.");
        }

        var s = c.Saving;
        db.Transactions.Add(SavingRules.Row(s, SavingPart.Payout, TransactionType.Income, amount, null, c.WalletId,
            await SavingRules.CategoryAsync(db, s.UserId, SavingPart.Payout, null, cancellationToken), null, c.At,
            request.Kind == "Maturity" ? $"{s.Name} matured" : $"{s.Name} claim"));
        if (request.Kind == "Maturity")
        {
            s.ClosedOn = c.Day;
        }

        return await SaveAsync(db, calendar, s, cancellationToken);
    }

    private static async Task<IResult> UndoLast(Guid id, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var saving = await SavingRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (saving is null)
        {
            return NotFound.Problem("Saving");
        }

        if (saving.ClosedOn is not null)
        {
            return Refused("This is closed. Delete it to start again.");
        }

        var last = await db.Transactions
            .Where(t => t.UserId == userId && t.SavingId == saving.Id && t.SavingSeq != null && t.SavingSeq > saving.SeqBase)
            .MaxAsync(t => t.SavingSeq, cancellationToken);
        if (last is null)
        {
            return Refused("Nothing is recorded to undo yet.");
        }

        var now = clock.GetUtcNow();
        foreach (var row in await db.Transactions.Where(t => t.UserId == userId && t.SavingId == saving.Id && t.SavingSeq == last).ToListAsync(cancellationToken))
        {
            row.DeletedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
