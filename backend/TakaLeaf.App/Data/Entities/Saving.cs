namespace TakaLeaf.App.Data.Entities;

public enum SavingKind
{
    /// <summary>Fixed deposit (FDR): a sum for a term, profit at maturity or every few months.</summary>
    Fdr,

    /// <summary>Deposit pension scheme (DPS): the same instalment every month for a term.</summary>
    Dps,

    /// <summary>A savings certificate (Sanchayapatra): a sum for a term, profit every few months or at maturity.</summary>
    Certificate,

    /// <summary>Prize bonds of ৳100, drawn four times a year.</summary>
    PrizeBond,

    /// <summary>An insurance policy: premiums out, claims and maturity in. Has no wallet.</summary>
    Insurance,
}

public enum PolicyType
{
    Life,
    Health,
    Car,
    Other,
}

/// <summary>The part a transaction plays in a saving or a policy.</summary>
public enum SavingPart
{
    /// <summary>Money put in (opening, a DPS instalment, bonds bought): a transfer into the saving's wallet.</summary>
    Deposit,

    /// <summary>Profit or interest before tax: income under Profit on savings.</summary>
    Profit,

    /// <summary>Tax taken at source on profit or a prize: an expense under Tax at source.</summary>
    Tax,

    /// <summary>Excise duty or an early encashment charge: an expense under Fees and charges.</summary>
    Fee,

    /// <summary>Money taken out (maturity, encashment, bonds sold back): a transfer out of the saving's wallet.</summary>
    Withdrawal,

    /// <summary>An insurance premium: an expense under Insurance.</summary>
    Premium,

    /// <summary>A prize bond prize before tax: income under Prize bond prize.</summary>
    Prize,

    /// <summary>A claim, survival benefit or maturity amount from a policy: income under Insurance payouts.</summary>
    Payout,
}

/// <summary>
/// An FDR, DPS, savings certificate, holding of prize bonds or an insurance policy. Everything but
/// a policy owns a wallet of type Savings whose (calculated) balance is the money in it, so savings
/// count as assets with no special case. Profit, tax, premiums and payouts are ordinary income and
/// expense rows marked with SavingId and SavingPart.
/// </summary>
public sealed class Saving : SyncedEntity
{
    public SavingKind Kind { get; set; }
    public string Name { get; set; } = "";

    /// <summary>The bank, post office or insurer.</summary>
    public string? Provider { get; set; }

    /// <summary>The saving's own wallet, of type Savings; null for a policy.</summary>
    public Guid? WalletId { get; set; }

    /// <summary>The account instalments and premiums come from and profit and payouts go to.</summary>
    public Guid PayFromWalletId { get; set; }

    /// <summary>
    /// In poisha. FDR and certificate: the sum in the current term. DPS: the monthly instalment.
    /// Prize bonds: the face value first bought. Policy: the premium.
    /// </summary>
    public long Amount { get; set; }

    /// <summary>Profit rate, hundredths of a percent a year (975 = 9.75 %). 0 for bonds and policies.</summary>
    public int RatePoints { get; set; }

    /// <summary>The term: FDR and certificate months, DPS instalments, policy months (0: renews with no end).</summary>
    public int Months { get; set; }

    /// <summary>FDR and certificate: months between profit payments, 0 for at maturity. Policy: months between premiums.</summary>
    public int EveryMonths { get; set; }

    /// <summary>FDR and certificate: the current term's start. DPS and policy: the first instalment or premium. Bonds: first bought.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Tax at source on profit (or on a prize), hundredths of a percent: 1000 = 10 %.</summary>
    public int TaxPoints { get; set; }

    /// <summary>FDR: the bank's excise duty a year, in poisha, taken at maturity.</summary>
    public long ChargesPerYear { get; set; }

    /// <summary>DPS: the maturity amount from the bank's book, when given.</summary>
    public long? MaturityAmount { get; set; }

    /// <summary>Policy: the sum assured or cover, in poisha.</summary>
    public long? Cover { get; set; }

    public PolicyType? Policy { get; set; }
    public string? PolicyNumber { get; set; }
    public string? Insured { get; set; }
    public string? Nominee { get; set; }

    /// <summary>Prize bonds: their numbers, one a line ("কখ 0412301").</summary>
    public string? BondNumbers { get; set; }

    /// <summary>DPS instalments, certificate profit payments or premiums paid before TakaLeaf.</summary>
    public int PaidBefore { get; set; }

    /// <summary>DPS: record each instalment on its date. Certificate: record each profit payment. Always on for an FDR.</summary>
    public bool AutoRecord { get; set; }

    /// <summary>Policy: show the premium on Home a week before.</summary>
    public bool Remind { get; set; }

    /// <summary>FDR: start a new term at maturity instead of paying it out.</summary>
    public bool Renew { get; set; }

    /// <summary>DPS: instalments marked missed, comma separated ("5,9").</summary>
    public string? Missed { get; set; }

    /// <summary>FDR renewals: the profit numbers used by earlier terms, so each term's numbers stay unique.</summary>
    public int SeqBase { get; set; }

    /// <summary>Set when it matured, was encashed or sold back, or the policy ended.</summary>
    public DateOnly? ClosedOn { get; set; }
}
