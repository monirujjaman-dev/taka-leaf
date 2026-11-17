using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Common.Outbox;

/// <summary>
/// Takes due messages (a lease with FOR UPDATE SKIP LOCKED, so several app instances never take the
/// same one), hands each to its handler, and records the result: done, retry later, or given up.
/// </summary>
public sealed class OutboxProcessor(
    AppDbContext db,
    IEnumerable<IOutboxHandler> handlers,
    IOptions<OutboxOptions> options,
    TimeProvider clock,
    ILogger<OutboxProcessor> logger)
{
    private readonly Dictionary<string, IOutboxHandler> byType = handlers.ToDictionary(h => h.Type);

    /// <summary>Delivers one batch. Returns how many messages it took.</summary>
    public async Task<int> ProcessDueAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var now = clock.GetUtcNow();
        var lockedUntil = now + TimeSpan.FromMinutes(Math.Max(1, settings.LeaseMinutes));
        var batch = Math.Max(1, settings.BatchSize);

        var claimed = await db.OutboxMessages.FromSql($"""
            UPDATE outbox_messages SET locked_until = {lockedUntil}
            WHERE id IN (
                SELECT id FROM outbox_messages
                WHERE processed_at IS NULL AND failed_at IS NULL AND available_at <= {now}
                  AND (locked_until IS NULL OR locked_until < {now})
                ORDER BY available_at
                LIMIT {batch}
                FOR UPDATE SKIP LOCKED)
            RETURNING *
            """).AsTracking().ToListAsync(cancellationToken);

        foreach (var message in claimed.OrderBy(m => m.AvailableAt))
        {
            await DeliverAsync(message, settings, cancellationToken);
        }

        return claimed.Count;
    }

    /// <summary>Deletes delivered messages after KeepDays and given-up ones after four times that.</summary>
    public async Task<int> CleanUpAsync(CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var keep = TimeSpan.FromDays(Math.Max(1, options.Value.KeepDays));
        var deliveredBefore = now - keep;
        var failedBefore = now - (keep * 4);
        return await db.OutboxMessages
            .Where(m => (m.ProcessedAt != null && m.ProcessedAt < deliveredBefore) || (m.FailedAt != null && m.FailedAt < failedBefore))
            .ExecuteDeleteAsync(cancellationToken);
    }

    private async Task DeliverAsync(OutboxMessage message, OutboxOptions settings, CancellationToken cancellationToken)
    {
        message.Attempts++;
        try
        {
            if (!byType.TryGetValue(message.Type, out var handler))
            {
                throw new PermanentOutboxFailure($"No handler for outbox messages of type \"{message.Type}\".");
            }

            await handler.HandleAsync(message.Payload ?? "", cancellationToken);
            message.ProcessedAt = clock.GetUtcNow();
            message.Payload = null;
            message.LastError = null;
            logger.LogInformation("Delivered outbox message {OutboxId} ({OutboxType}) on attempt {Attempt}", message.Id, message.Type, message.Attempts);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            message.LastError = Truncate($"{exception.GetType().Name}: {exception.Message}");
            if (exception is PermanentOutboxFailure || OutboxRetryPolicy.ShouldGiveUp(message.Attempts, settings))
            {
                message.FailedAt = clock.GetUtcNow();
                message.Payload = null;
                logger.LogError(exception, "Gave up on outbox message {OutboxId} ({OutboxType}) after {Attempt} attempts", message.Id, message.Type, message.Attempts);
            }
            else
            {
                var delay = OutboxRetryPolicy.DelayAfter(message.Attempts, settings, OutboxRetryPolicy.RandomJitter());
                message.AvailableAt = clock.GetUtcNow() + delay;
                logger.LogWarning(exception, "Outbox message {OutboxId} ({OutboxType}) failed on attempt {Attempt}; next try in {RetrySeconds:0} s", message.Id, message.Type, message.Attempts, delay.TotalSeconds);
            }
        }

        message.LockedUntil = null;
        await db.SaveChangesAsync(CancellationToken.None);
    }

    private static string Truncate(string text) => text.Length <= 2000 ? text : text[..2000];
}
