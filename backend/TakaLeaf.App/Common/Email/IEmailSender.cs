namespace TakaLeaf.App.Common.Email;

/// <summary>An email to send. Every email has a plain-text body; branded ones also have HTML.</summary>
public sealed record EmailMessage(string To, string Subject, string TextBody, string? HtmlBody = null);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}
