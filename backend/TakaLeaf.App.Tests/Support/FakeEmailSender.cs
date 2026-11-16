using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using TakaLeaf.App.Common.Email;

namespace TakaLeaf.App.Tests.Support;

public sealed partial class FakeEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> sent = new();

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        sent.Enqueue(message);
        return Task.CompletedTask;
    }

    public IReadOnlyList<EmailMessage> SentTo(string email) => sent.Where(m => m.To == email).ToList();

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
