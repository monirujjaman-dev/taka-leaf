using TakaLeaf.App.Features.Loans;

namespace TakaLeaf.App.Features.Savings;

/// <summary>
/// The arithmetic of savings, twin of packages/shared/src/savings.ts (same results to the poisha).
/// Amounts in poisha, rates and tax in hundredths of a percent; every division rounds half up.
/// </summary>
public static class SavingMath
{
    public const int MaxRatePoints = 10_000;
    public const int MaxMonths = 600;

    /// <summary>A ৳100 prize bond, in poisha.</summary>
    public const long BondValue = 10_000;

    /// <summary>A bond counts in a draw only if bought at least this many days before it.</summary>
    public const int DrawHoldDays = 60;

    /// <summary>Days of grace after a life premium falls due.</summary>
    public const int GraceDays = 30;

    /// <summary>The prizes of each ৳100 prize bond draw, per series, 1st to 5th.</summary>
    public static readonly long[] Prizes = [60_000_000, 32_500_000, 10_000_000, 5_000_000, 1_000_000];

    /// <summary>Simple profit on a sum for some months: principal × rate × months / 12, rounded half up.</summary>
    public static long Profit(long principal, int ratePoints, int months) =>
        principal <= 0 || ratePoints <= 0 || months <= 0 ? 0 : (long)(((Int128)principal * ratePoints * months * 2 + 120_000) / 240_000);

    /// <summary>Tax at source on an amount: amount × points / 10,000, rounded half up (1000 = 10 %).</summary>
    public static long Tax(long amount, int taxPoints) =>
        amount <= 0 || taxPoints <= 0 ? 0 : (long)(((Int128)amount * taxPoints * 2 + 10_000) / 20_000);

    /// <summary>
    /// What a DPS is worth at maturity: each month the instalment goes in, then a month's interest
    /// on the whole is added (compounded monthly), as banks quote it.
    /// </summary>
    public static long DpsMaturity(long instalment, int ratePoints, int months)
    {
        long balance = 0;
        for (var i = 0; i < months; i++)
        {
            balance += instalment;
            balance += LoanMath.MonthlyInterest(balance, ratePoints);
        }

        return balance;
    }

    /// <summary>The bank's excise duty over a term: the yearly duty for each year or part year.</summary>
    public static long Excise(long perYear, int months) => perYear <= 0 ? 0 : perYear * Math.Max(1, (months + 11) / 12);

    /// <summary>The next ৳100 prize bond draw on or after a day: 31 January, 30 April, 31 July and 31 October.</summary>
    public static DateOnly NextDraw(DateOnly from)
    {
        foreach (var year in new[] { from.Year, from.Year + 1 })
        {
            foreach (var draw in new[] { new DateOnly(year, 1, 31), new DateOnly(year, 4, 30), new DateOnly(year, 7, 31), new DateOnly(year, 10, 31) })
            {
                if (draw >= from)
                {
                    return draw;
                }
            }
        }

        return new DateOnly(from.Year + 1, 1, 31);
    }

    /// <summary>Bonds bought after this day wait for the draw after.</summary>
    public static DateOnly DrawCutoff(DateOnly draw) => draw.AddDays(-DrawHoldDays);

    /// <summary>The tax year (1 July to 30 June) a day falls in, by its first day.</summary>
    public static DateOnly TaxYearStart(DateOnly day) => new(day.Month >= 7 ? day.Year : day.Year - 1, 7, 1);
}
