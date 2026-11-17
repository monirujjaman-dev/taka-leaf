using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using TakaLeaf.App.Common.Email;

namespace TakaLeaf.App.Tests.Support;

/// <summary>
/// Captures emails instead of sending them. Emails go through the outbox, so reading them first
/// delivers whatever is due (the test app turns the background worker off and sets <see cref="Deliver"/>).
/// </summary>
public sealed partial class FakeEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> sent = new();
    private readonly ConcurrentQueue<Exception> failures = new();

    /// <summary>Runs the outbox until nothing is due.</summary>
    public Func<Task>? Deliver { get; set; }

    /// <summary>The next send throws this, as a mail server problem would.</summary>
    public void FailNext(Exception exception) => failures.Enqueue(exception);

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        if (failures.TryDequeue(out var failure))
        {
            throw failure;
        }

        sent.Enqueue(message);
        return Task.CompletedTask;
    }

    /// <summary>Delivers due outbox messages now. Task.Run keeps xUnit's context out of the wait.</summary>
    public void Flush() => Task.Run(() => Deliver?.Invoke() ?? Task.CompletedTask).GetAwaiter().GetResult();

    public IReadOnlyList<EmailMessage> SentTo(string email)
    {
        Flush();
        return sent.Where(m => m.To == email).ToList();
    }

    /// <summary>The token from the newest email to this address that holds a link.</summary>
    public string LatestToken(string email)
    {
        var message = SentTo(email).LastOrDefault(m => m.TextBody.Contains("token="))
            ?? throw new InvalidOperationException($"No email with a link was sent to {email}.");
        return TokenInLink().Match(message.TextBody).Groups[1].Value;
    }

    [GeneratedRegex("token=([A-Za-z0-9_-]+)")]
    private static partial Regex TokenInLink();
}
