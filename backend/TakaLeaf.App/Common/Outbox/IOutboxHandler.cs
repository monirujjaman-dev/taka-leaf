namespace TakaLeaf.App.Common.Outbox;

/// <summary>Delivers one kind of outbox message. Throw to retry later; throw <see cref="PermanentOutboxFailure"/> to give up now.</summary>
public interface IOutboxHandler
{
    string Type { get; }

    Task HandleAsync(string payload, CancellationToken cancellationToken);
}

/// <summary>A failure that retrying cannot fix, such as a mail server refusing the address.</summary>
public sealed class PermanentOutboxFailure(string message, Exception? inner = null) : Exception(message, inner);
