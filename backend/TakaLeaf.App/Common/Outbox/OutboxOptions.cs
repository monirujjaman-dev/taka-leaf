namespace TakaLeaf.App.Common.Outbox;

/// <summary>Settings for the outbox worker ("Outbox" in appsettings).</summary>
public sealed class OutboxOptions
{
    public const string Section = "Outbox";

    /// <summary>Whether the background worker runs. Tests turn it off and deliver directly.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>How often to look for due messages when nothing new was written.</summary>
    public int PollSeconds { get; set; } = 10;

    public int BatchSize { get; set; } = 20;

    /// <summary>Attempts in all, the first one included, before a message is given up.</summary>
    public int MaxAttempts { get; set; } = 8;

    /// <summary>Wait after the first failure; it doubles after each one, up to MaxRetryMinutes.</summary>
    public int FirstRetrySeconds { get; set; } = 30;

    public int MaxRetryMinutes { get; set; } = 60;

    /// <summary>How long a worker may hold a message before another may take it (a crash mid-send).</summary>
    public int LeaseMinutes { get; set; } = 5;

    /// <summary>Delivered messages are deleted after this many days; given-up ones after four times as long.</summary>
    public int KeepDays { get; set; } = 7;
}
