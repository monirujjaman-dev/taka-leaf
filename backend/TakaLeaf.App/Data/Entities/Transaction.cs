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
    public DateTimeOffset OccurredAt { get; set; }
    public string? Note { get; set; }
}
