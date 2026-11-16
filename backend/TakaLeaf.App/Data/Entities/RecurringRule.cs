namespace TakaLeaf.App.Data.Entities;

public enum RecurringFrequency
{
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

/// <summary>
/// A transaction that repeats: rent, salary, a subscription. Each time it falls due it is either
/// recorded automatically or waits for the user to record or skip it.
/// </summary>
public sealed class RecurringRule : SyncedEntity
{
    public TransactionType Type { get; set; }

    /// <summary>In poisha. The usual amount; the user can change it when recording.</summary>
    public long Amount { get; set; }
    public Guid? FromWalletId { get; set; }
    public Guid? ToWalletId { get; set; }
    public Guid? CategoryId { get; set; }
    public string? Note { get; set; }

    public RecurringFrequency Frequency { get; set; }

    /// <summary>Every how many days, weeks, months or years.</summary>
    public int Interval { get; set; } = 1;

    /// <summary>The first date, in local time. Monthly and yearly dates keep its day (31st becomes the month's last day).</summary>
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    /// <summary>How many dates have been recorded or skipped; the next date is worked out from StartDate and this.</summary>
    public int Occurrences { get; set; }
    public DateOnly NextDate { get; set; }

    public bool AutoRecord { get; set; }
    public bool Paused { get; set; }
}
