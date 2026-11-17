namespace TakaLeaf.App.Features.Loans;

/// <summary>One EMI of a schedule. Amounts in poisha.</summary>
public sealed record Instalment(int Number, long Principal, long Interest, long Total, long BalanceAfter);

/// <summary>
/// Loan arithmetic, the same as packages/shared/src/loan.ts. Rates are "rate points", hundredths of
/// a percent a year (950 = 9.50 %). Interest is on the reducing balance: each month the balance ×
/// yearly rate / 12, rounded half up to the poisha; the rest of the EMI repays principal. Less than
/// ৳1 left after an EMI is rounding, so that EMI takes it.
/// </summary>
public static class LoanMath
{
    public const int MaxRatePoints = 10_000;
    public const int MaxMonths = 600;
    public const long RoundingSlack = 100;

    public static long MonthlyInterest(long balance, int ratePoints) =>
        balance <= 0 || ratePoints <= 0 ? 0 : (long)(((Int128)balance * ratePoints * 2 + 120_000) / 240_000);

    public static long EmiFor(long principal, int ratePoints, int months)
    {
        if (principal <= 0 || months <= 0)
        {
            return 0;
        }

        if (ratePoints <= 0)
        {
            return (long)Math.Round(principal / (decimal)months, MidpointRounding.AwayFromZero);
        }

        var rate = ratePoints / 120_000m;
        var growth = 1m;
        for (var i = 0; i < months; i++)
        {
            growth *= 1 + rate;
        }

        return (long)Math.Round(principal * rate * growth / (growth - 1), MidpointRounding.AwayFromZero);
    }

    public static List<Instalment> Schedule(long balance, int ratePoints, long emi, int firstNumber = 1, int max = MaxMonths)
    {
        var rows = new List<Instalment>();
        var left = balance;
        while (left > 0 && rows.Count < max)
        {
            var interest = MonthlyInterest(left, ratePoints);
            var principal = Math.Min(emi - interest, left);
            if (principal <= 0)
            {
                break;
            }

            if (left - principal < RoundingSlack)
            {
                principal = left;
            }

            left -= principal;
            rows.Add(new Instalment(firstNumber + rows.Count, principal, interest, principal + interest, left));
        }

        return rows;
    }

    /// <summary>What is still owed after <paramref name="paid"/> EMIs on the original schedule.</summary>
    public static long BalanceAfter(long principal, int ratePoints, long emi, int paid)
    {
        if (paid <= 0)
        {
            return principal;
        }

        var rows = Schedule(principal, ratePoints, emi, 1, paid);
        return rows.Count < paid ? 0 : rows[^1].BalanceAfter;
    }

    public static long InterestOfFirst(long principal, int ratePoints, long emi, int paid) =>
        paid <= 0 ? 0 : Schedule(principal, ratePoints, emi, 1, paid).Sum(row => row.Interest);
}
