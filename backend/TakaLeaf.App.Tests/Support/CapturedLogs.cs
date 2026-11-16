using System.Collections.Concurrent;
using Serilog.Core;
using Serilog.Events;

namespace TakaLeaf.App.Tests.Support;

/// <summary>A Serilog sink that keeps every event, so tests can check what was logged.</summary>
public sealed class CapturedLogs : ILogEventSink
{
    private readonly ConcurrentQueue<LogEvent> events = new();

    public void Emit(LogEvent logEvent) => events.Enqueue(logEvent);

    public static string? Text(LogEvent logEvent, string property) =>
        logEvent.Properties.TryGetValue(property, out var value) && value is ScalarValue { Value: var scalar }
            ? scalar?.ToString()
            : null;

    /// <summary>The request summary line is written as the request ends, so wait briefly for it.</summary>
    public async Task<LogEvent> WaitForRequestAsync(string path, Func<LogEvent, bool>? where = null)
    {
        for (var attempt = 0; attempt < 50; attempt++)
        {
            var found = events.LastOrDefault(e => Text(e, "RequestPath") == path && (where?.Invoke(e) ?? true));
            if (found is not null)
            {
                return found;
            }

            await Task.Delay(50);
        }

        throw new InvalidOperationException($"No request log for {path}.");
    }
}
