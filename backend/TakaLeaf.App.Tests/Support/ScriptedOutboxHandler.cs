using System.Collections.Concurrent;
using TakaLeaf.App.Common.Outbox;

namespace TakaLeaf.App.Tests.Support;

/// <summary>An outbox handler for the "test" type whose results the test sets in advance.</summary>
public sealed class ScriptedOutboxHandler : IOutboxHandler
{
    public const string MessageType = "test";

    private readonly ConcurrentQueue<Exception?> outcomes = new();

    public string Type => MessageType;

    public ConcurrentQueue<string> Handled { get; } = new();

    /// <summary>The next calls throw these in turn (null = succeed); after that every call succeeds.</summary>
    public void Script(params Exception?[] results)
    {
        foreach (var result in results)
        {
            outcomes.Enqueue(result);
        }
    }

    public async Task HandleAsync(string payload, CancellationToken cancellationToken)
    {
        // Long enough for two processors started together to overlap.
        await Task.Delay(50, cancellationToken);
        if (outcomes.TryDequeue(out var failure) && failure is not null)
        {
            throw failure;
        }

        Handled.Enqueue(payload);
    }
}
