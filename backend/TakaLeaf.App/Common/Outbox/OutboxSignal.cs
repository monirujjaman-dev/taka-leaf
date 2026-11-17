using System.Threading.Channels;

namespace TakaLeaf.App.Common.Outbox;

/// <summary>Wakes the worker as soon as a request saves a message, so emails do not wait for the next poll.</summary>
public sealed class OutboxSignal
{
    private readonly Channel<bool> channel = Channel.CreateBounded<bool>(new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite });

    public void Notify() => channel.Writer.TryWrite(true);

    /// <summary>Returns when notified or when <paramref name="timeout"/> passes.</summary>
    public async Task WaitAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        using var timer = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timer.CancelAfter(timeout);
        try
        {
            await channel.Reader.ReadAsync(timer.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // The poll interval passed.
        }
    }
}
