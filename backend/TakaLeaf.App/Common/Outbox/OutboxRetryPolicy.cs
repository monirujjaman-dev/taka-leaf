namespace TakaLeaf.App.Common.Outbox;

/// <summary>
/// When to try a failed message again: exponential backoff with ±20% jitter, capped, and a limit on
/// attempts. With the defaults the waits are about 30 s, 1, 2, 4, 8, 16, 32 and 60 minutes.
/// </summary>
public static class OutboxRetryPolicy
{
    /// <summary>The wait after <paramref name="failures"/> failed attempts (1 or more).</summary>
    public static TimeSpan DelayAfter(int failures, OutboxOptions options, double jitter)
    {
        var first = TimeSpan.FromSeconds(Math.Max(1, options.FirstRetrySeconds));
        var max = TimeSpan.FromMinutes(Math.Max(1, options.MaxRetryMinutes));
        var exponent = Math.Min(Math.Max(failures, 1) - 1, 20);
        var delay = TimeSpan.FromTicks(Math.Min(first.Ticks * (1L << exponent), max.Ticks));
        return delay * Math.Clamp(jitter, 0.8, 1.2);
    }

    /// <summary>A random jitter factor between 0.8 and 1.2.</summary>
    public static double RandomJitter() => 0.8 + (Random.Shared.NextDouble() * 0.4);

    public static bool ShouldGiveUp(int attempts, OutboxOptions options) => attempts >= Math.Max(1, options.MaxAttempts);
}
