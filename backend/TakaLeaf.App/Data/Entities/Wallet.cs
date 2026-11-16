namespace TakaLeaf.App.Data.Entities;

public enum WalletType
{
    Cash,
    Bank,
    CreditCard,
    Mfs,

    /// <summary>Money a person owes the user. One per person.</summary>
    Lent,

    /// <summary>Money the user owes a person. One per person.</summary>
    Borrowed,
}

public sealed class Wallet : SyncedEntity
{
    public WalletType Type { get; set; }
    public string Name { get; set; } = "";

    /// <summary>In poisha. The balance itself is never stored; it is calculated from transactions.</summary>
    public long OpeningBalance { get; set; }

    /// <summary>In poisha. Credit cards only.</summary>
    public long? CreditLimit { get; set; }

    /// <summary>Set for Lent and Borrowed wallets.</summary>
    public Guid? PersonId { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool Archived { get; set; }
    public bool ExcludedFromTotal { get; set; }
    public int SortOrder { get; set; }
}
