using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace TakaLeaf.App.Common.Email;

public sealed class EmailOptions
{
    public const string Section = "Email";

    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1025;
    public SecureSocketOptions Security { get; set; } = SecureSocketOptions.Auto;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string From { get; set; } = "TakaLeaf <no-reply@takaleaf.local>";
}

/// <summary>Sends email (text, plus HTML when there is some) over SMTP. In development the mail catcher on port 1025 receives it.</summary>
public sealed class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var mime = new MimeMessage();
        mime.From.Add(MailboxAddress.Parse(settings.From));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Subject = message.Subject;
        // multipart/alternative: mail apps show the HTML and fall back to the text.
        mime.Body = new BodyBuilder { TextBody = message.TextBody, HtmlBody = message.HtmlBody }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(settings.Host, settings.Port, settings.Security, cancellationToken);
        if (!string.IsNullOrEmpty(settings.Username))
        {
            await client.AuthenticateAsync(settings.Username, settings.Password ?? "", cancellationToken);
        }

        await client.SendAsync(mime, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
