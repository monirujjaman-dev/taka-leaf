namespace TakaLeaf.App.Data.Entities;

public enum TransactionType
{
    /// <summary>Money arrives in ToWallet.</summary>
    Income,

    /// <summary>Money leaves FromWallet.</summary>
    Expense,

    /// <summary>Money moves from FromWallet to ToWallet. Lending, borrowing and repayment are transfers too.</summary>
    Transfer,
}

public sealed class Transaction : SyncedEntity
{
    public TransactionType Type { get; set; }

    /// <summary>In poisha, always greater than zero.</summary>
    public long Amount { get; set; }
    public Guid? FromWalletId { get; set; }
    public Guid? ToWalletId { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid? PersonId { get; set; }

    /// <summary>For a transfer fee: the transfer this expense belongs to.</summary>
    public Guid? FeeOfId { get; set; }

    /// <summary>The recurring rule this was recorded from, if any.</summary>
    public Guid? RecurringRuleId { get; set; }

    /// <summary>For a recurring transaction: the local date it was due, so the same date is never recorded twice.</summary>
    public DateOnly? RecurringDate { get; set; }

    /// <summary>The bank loan or card EMI this row belongs to; such rows change only through Loans.</summary>
    public Guid? LoanId { get; set; }

    /// <summary>Which EMI (1 = the first) a payment row pays; null for extra payments and the loan's own rows.</summary>
    public int? LoanEmi { get; set; }

    /// <summary>What the row is to its loan.</summary>
    public LoanPart? LoanPart { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public string? Note { get; set; }
}
