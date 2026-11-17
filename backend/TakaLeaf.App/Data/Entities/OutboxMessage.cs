namespace TakaLeaf.App.Data.Entities;

/// <summary>
/// Work to do after a request has saved, written in the same database transaction as the change
/// that caused it (the outbox pattern). The outbox worker delivers it and retries with backoff.
/// System table: not owned by a user and not synced.
/// </summary>
public class OutboxMessage
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>Which handler delivers it, e.g. "email".</summary>
    public string Type { get; set; } = "";

    /// <summary>The handler's input as JSON. Cleared once the message is done, since it can hold links.</summary>
    public string? Payload { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Not tried before this time: now for a new message, later after a failure.</summary>
    public DateTimeOffset AvailableAt { get; set; }

    public int Attempts { get; set; }

    /// <summary>Set while a worker holds the message, so two workers never send it twice.</summary>
    public DateTimeOffset? LockedUntil { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset? ProcessedAt { get; set; }

    /// <summary>Given up: a permanent failure, or every attempt used.</summary>
    public DateTimeOffset? FailedAt { get; set; }
}
