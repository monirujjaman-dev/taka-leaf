namespace TakaLeaf.App.Data.Entities;

public enum LoanType
{
    /// <summary>A loan from a bank, repaid in EMIs from one of the user's wallets.</summary>
    Bank,

    /// <summary>An EMI plan on a credit card: each month's instalment is added to the card's balance.</summary>
    CardEmi,
}

/// <summary>The part a transaction plays in a loan.</summary>
public enum LoanPart
{
    /// <summary>The loan money arriving in a wallet: a transfer from the loan's wallet.</summary>
    Disbursement,

    /// <summary>A card EMI's purchase: an expense from the loan's wallet.</summary>
    Purchase,

    /// <summary>Principal repaid: a transfer into the loan's wallet.</summary>
    Principal,

    /// <summary>An EMI's interest: an expense under Loan interest.</summary>
    Interest,

    /// <summary>A processing or late fee: an expense under Fees and charges.</summary>
    Fee,
}

/// <summary>
/// A bank loan or credit card EMI. What is left to pay is the balance of its own Loan wallet
/// (negative), so loans count as liabilities like any other wallet; nothing else is stored.
/// </summary>
public sealed class Loan : SyncedEntity
{
    public LoanType Type { get; set; }
    public string Name { get; set; } = "";

    /// <summary>The bank, for a bank loan.</summary>
    public string? Lender { get; set; }

    /// <summary>The loan's own wallet, of type Loan.</summary>
    public Guid WalletId { get; set; }

    /// <summary>Where EMIs are paid from by default; for a card EMI, the credit card.</summary>
    public Guid PayFromWalletId { get; set; }

    /// <summary>In poisha: the amount borrowed (or the price, for a card EMI).</summary>
    public long Principal { get; set; }

    /// <summary>Hundredths of a percent a year: 950 is 9.50 %. 0 for a 0 % EMI.</summary>
    public int RatePoints { get; set; }

    public int Months { get; set; }

    /// <summary>In poisha: the monthly instalment, worked out or as the bank gave it.</summary>
    public long Emi { get; set; }

    /// <summary>The local date EMI 1 is due; EMI n is due n − 1 months later.</summary>
    public DateOnly FirstDueDate { get; set; }

    /// <summary>EMIs paid before the loan was added to TakaLeaf.</summary>
    public int PaidBefore { get; set; }

    /// <summary>Record each EMI on its date without asking (always on for a card EMI).</summary>
    public bool AutoRecord { get; set; }

    /// <summary>Set when the rest was paid off early.</summary>
    public DateOnly? ClosedOn { get; set; }
}
