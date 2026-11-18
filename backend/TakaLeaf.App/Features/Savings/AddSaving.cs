using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Savings;

/// <summary>
/// POST /api/savings - adds an FDR, DPS, savings certificate, prize bonds or a policy. Everything
/// but a policy gets its own Savings wallet. New money comes from an account on the start date;
/// one held from before starts from today's amount and nothing moves.
/// </summary>
public static class AddSaving
{
    public static RouteGroupBuilder MapAddSaving(this RouteGroupBuilder group)
    {
        group.MapPost("/", Handle).WithName("AddSaving");
        return group;
    }

    /// <summary>Tax at source on certificates: 5 % while all of them come to ৳5,00,000 or less, else 10 %.</summary>
    public const long CertificateLowTaxLimit = 50_000_000;

    private static async Task<IResult> Handle(
        AddSavingRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        if (request.Kind is not { } kind || !Enum.IsDefined(kind))
        {
            return ValidationErrors.For("kind", "Choose FDR, DPS, Sanchayapatra, prize bonds or insurance.");
        }

        var (saving, problem) = await BuildAsync(db, calendar, userId, request, cancellationToken);
        if (problem is not null)
        {
            return problem;
        }

        var held = request.AlreadyHeld ?? false;
        Guid? from = null;
        var opening = 0L;
        var moved = 0L;
        if (kind == SavingKind.Dps)
        {
            // A DPS is paid in month by month; one already running starts with what was paid in.
            opening = saving!.PaidBefore * saving.Amount;
        }
        else if (kind != SavingKind.Insurance)
        {
            if (held)
            {
                opening = saving!.Amount;
            }
            else
            {
                if (await SavingRules.CheckAccountAsync(db, userId, request.FromWalletId, "fromWalletId", null, cancellationToken) is { } fromProblem)
                {
                    return fromProblem;
                }

                from = request.FromWalletId;
                moved = saving!.Amount;
            }
        }

        if (SavingRules.HasWallet(kind))
        {
            var wallet = new Wallet { UserId = userId, Type = WalletType.Savings, Name = saving!.Name, OpeningBalance = opening, SortOrder = 0 };
            db.Wallets.Add(wallet);
            saving.WalletId = wallet.Id;
        }

        db.Savings.Add(saving!);
        if (moved > 0 && from is { } fromId)
        {
            // On the start date at 9 am, but never in the future.
            var at = calendar.StartOf(saving!.StartDate) + TimeSpan.FromHours(9);
            var now = clock.GetUtcNow();
            db.Transactions.Add(SavingRules.Row(saving, SavingPart.Deposit, TransactionType.Transfer, moved, fromId, saving.WalletId, null, null,
                at > now ? now : at, kind == SavingKind.PrizeBond ? $"{moved / SavingMath.BondValue} prize bonds" : $"{saving.Name} opened"));
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/savings/{saving!.Id}", await SavingRules.DtoAsync(db, calendar, saving, cancellationToken));
    }

    /// <summary>Checks a new saving's fields for its kind and fills in the defaults; saves nothing.</summary>
    internal static async Task<(Saving? Saving, IResult? Problem)> BuildAsync(
        AppDbContext db, LocalCalendar calendar, Guid userId, AddSavingRequest r, CancellationToken cancellationToken)
    {
        var kind = r.Kind!.Value;
        if (Text.LabelProblem(r.Name, SavingRules.NameMax) is { } nameProblem)
        {
            return (null, ValidationErrors.For("name", nameProblem));
        }

        foreach (var (field, value) in new[] { ("provider", r.Provider), ("policyNumber", r.PolicyNumber), ("insured", r.Insured), ("nominee", r.Nominee) })
        {
            if (Text.Clean(value) is { Length: > SavingRules.NameMax })
            {
                return (null, ValidationErrors.For(field, $"Use at most {SavingRules.NameMax} characters."));
            }
        }

        if (await SavingRules.CheckAccountAsync(db, userId, r.PayFromWalletId, "payFromWalletId", null, cancellationToken) is { } payProblem)
        {
            return (null, payProblem);
        }

        if (r.StartDate is not { } start)
        {
            return (null, ValidationErrors.For("startDate", kind switch
            {
                SavingKind.Dps => "Choose the date of the first instalment.",
                SavingKind.Insurance => "Choose the date of the first premium.",
                SavingKind.PrizeBond => "Choose the day you bought them.",
                _ => "Choose the day it was opened.",
            }));
        }

        var amount = r.Amount ?? 0;
        if (kind == SavingKind.PrizeBond)
        {
            if (r.BondCount is not { } count || count < 1 || count > 100_000)
            {
                return (null, ValidationErrors.For("bondCount", "Enter how many ৳100 bonds, 1 or more."));
            }

            amount = count * SavingMath.BondValue;
        }
        else if (amount <= 0 || amount > TransactionRules.MaxAmount)
        {
            return (null, ValidationErrors.For("amount", kind switch
            {
                SavingKind.Dps => "Enter the monthly instalment, more than zero.",
                SavingKind.Insurance => "Enter the premium, more than zero.",
                _ => "Enter the amount, more than zero.",
            }));
        }

        var rate = r.RatePoints ?? 0;
        if (rate is < 0 or > SavingMath.MaxRatePoints)
        {
            return (null, ValidationErrors.For("ratePoints", "Enter the profit rate, from 0 to 100 % a year."));
        }

        var months = r.Months ?? 0;
        var every = r.EveryMonths ?? (kind == SavingKind.Insurance ? 12 : 0);
        var paidBefore = r.PaidBefore ?? 0;
        switch (kind)
        {
            case SavingKind.Fdr:
            case SavingKind.Certificate:
                if (months is < 1 or > SavingMath.MaxMonths)
                {
                    return (null, ValidationErrors.For("months", "Choose the term, from 1 month."));
                }

                if (!SavingRules.ProfitPeriods.Contains(every) || (every > 0 && months % every != 0))
                {
                    return (null, ValidationErrors.For("everyMonths", "Choose how often profit is paid; the term must be a whole number of those."));
                }

                var payments = every > 0 ? months / every : 1;
                if (paidBefore < 0 || paidBefore >= payments)
                {
                    return (null, ValidationErrors.For("paidBefore", $"Enter the profit payments already received, from 0 to {payments - 1}."));
                }

                if (kind == SavingKind.Fdr)
                {
                    paidBefore = 0;
                }

                break;
            case SavingKind.Dps:
                if (months is < 1 or > SavingMath.MaxMonths)
                {
                    return (null, ValidationErrors.For("months", "Choose the term, from 1 month."));
                }

                every = 1;
                if (paidBefore < 0 || paidBefore >= months)
                {
                    return (null, ValidationErrors.For("paidBefore", $"Enter the instalments already paid, from 0 to {months - 1}."));
                }

                break;
            case SavingKind.Insurance:
                if (!SavingRules.PremiumPeriods.Contains(every))
                {
                    return (null, ValidationErrors.For("everyMonths", "Choose how often the premium is paid."));
                }

                if (months is < 0 or > SavingMath.MaxMonths || (months > 0 && months % every != 0))
                {
                    return (null, ValidationErrors.For("months", "Choose the term, or none for a policy that renews."));
                }

                if (paidBefore < 0 || (months > 0 && paidBefore > months / every))
                {
                    return (null, ValidationErrors.For("paidBefore", "Enter the premiums already paid."));
                }

                if (r.Policy is not { } policyType || !Enum.IsDefined(policyType))
                {
                    return (null, ValidationErrors.For("policy", "Choose life, health, car or other."));
                }

                break;
            default:
                months = 0;
                every = 0;
                paidBefore = 0;
                break;
        }

        var tax = r.TaxPoints ?? kind switch
        {
            SavingKind.Fdr => 1000,
            SavingKind.PrizeBond => 2000,
            SavingKind.Certificate => await CertificateTaxAsync(db, calendar, userId, amount, cancellationToken),
            _ => 0,
        };
        if (tax is < 0 or > SavingMath.MaxRatePoints)
        {
            return (null, ValidationErrors.For("taxPoints", "Enter the tax at source, from 0 to 100 %."));
        }

        if (r.ChargesPerYear is < 0 or > TransactionRules.MaxAmount || r.MaturityAmount is <= 0 or > TransactionRules.MaxAmount || r.Cover is <= 0 or > TransactionRules.MaxAmount)
        {
            return (null, ValidationErrors.For(r.ChargesPerYear is < 0 ? "chargesPerYear" : r.MaturityAmount is <= 0 ? "maturityAmount" : "cover", "Enter an amount more than zero."));
        }

        var bonds = kind == SavingKind.PrizeBond ? SavingRules.JoinBonds(r.BondNumbers) : null;
        if (bonds is { Length: > SavingRules.BondNumbersMax })
        {
            return (null, ValidationErrors.For("bondNumbers", "That is too many numbers to keep."));
        }

        var saving = new Saving
        {
            UserId = userId,
            Kind = kind,
            Name = Text.Clean(r.Name)!,
            Provider = Text.Clean(r.Provider),
            PayFromWalletId = r.PayFromWalletId!.Value,
            Amount = amount,
            RatePoints = kind is SavingKind.PrizeBond or SavingKind.Insurance ? 0 : rate,
            Months = months,
            EveryMonths = every,
            StartDate = start,
            TaxPoints = kind == SavingKind.Insurance ? 0 : kind == SavingKind.Dps && r.TaxPoints is null ? 1000 : tax,
            ChargesPerYear = kind == SavingKind.Fdr ? r.ChargesPerYear ?? 0 : 0,
            MaturityAmount = kind == SavingKind.Dps ? r.MaturityAmount : null,
            Cover = kind == SavingKind.Insurance ? r.Cover : null,
            Policy = kind == SavingKind.Insurance ? r.Policy : null,
            PolicyNumber = kind == SavingKind.Insurance ? Text.Clean(r.PolicyNumber) : null,
            Insured = kind == SavingKind.Insurance ? Text.Clean(r.Insured) : null,
            Nominee = kind == SavingKind.Insurance ? Text.Clean(r.Nominee) : null,
            BondNumbers = bonds,
            PaidBefore = paidBefore,
            AutoRecord = kind == SavingKind.Fdr || (kind is SavingKind.Dps or SavingKind.Certificate && (r.AutoRecord ?? kind == SavingKind.Certificate)),
            Remind = kind == SavingKind.Insurance && (r.Remind ?? true),
            Renew = kind == SavingKind.Fdr && (r.Renew ?? true),
        };
        return (saving, null);
    }

    /// <summary>The certificate tax rate that would apply with one more certificate of this amount.</summary>
    internal static async Task<int> CertificateTaxAsync(AppDbContext db, LocalCalendar calendar, Guid userId, long amount, CancellationToken cancellationToken)
    {
        var open = await db.Savings.Where(s => s.UserId == userId && s.Kind == SavingKind.Certificate && s.ClosedOn == null).ToListAsync(cancellationToken);
        var states = await SavingRules.StatesAsync(db, calendar, userId, open, cancellationToken);
        return states.Values.Sum(s => s.Balance) + amount <= CertificateLowTaxLimit ? 500 : 1000;
    }
}
