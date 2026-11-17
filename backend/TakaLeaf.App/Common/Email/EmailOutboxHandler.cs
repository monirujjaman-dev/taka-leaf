using System.Text.Json;
using MailKit.Net.Smtp;
using TakaLeaf.App.Common.Outbox;

namespace TakaLeaf.App.Common.Email;

/// <summary>Sends the emails written to the outbox. A refused address is permanent; anything else is retried.</summary>
public sealed class EmailOutboxHandler(IEmailSender sender) : IOutboxHandler
{
    public const string MessageType = "email";

    public string Type => MessageType;

    public async Task HandleAsync(string payload, CancellationToken cancellationToken)
    {
        EmailMessage? message;
        try
        {
            message = JsonSerializer.Deserialize<EmailMessage>(payload, JsonSerializerOptions.Web);
        }
        catch (JsonException exception)
        {
            throw new PermanentOutboxFailure("The email in the outbox could not be read.", exception);
        }

        if (message is null || string.IsNullOrWhiteSpace(message.To))
        {
            throw new PermanentOutboxFailure("The email in the outbox has no recipient.");
        }

        try
        {
            await sender.SendAsync(message, cancellationToken);
        }
        catch (SmtpCommandException exception) when (IsPermanent(exception))
        {
            throw new PermanentOutboxFailure($"The mail server refused the email ({(int)exception.StatusCode}).", exception);
        }
    }

    /// <summary>5xx replies about the recipient or sender (550 no such mailbox, 553 bad address…) will not change on a retry.</summary>
    private static bool IsPermanent(SmtpCommandException exception) =>
        (int)exception.StatusCode >= 500
        && exception.ErrorCode is SmtpErrorCode.RecipientNotAccepted or SmtpErrorCode.SenderNotAccepted;
}

/// <summary>Writes emails to the outbox instead of sending them during the request.</summary>
public static class EmailOutboxExtensions
{
    public static void AddEmail(this OutboxWriter outbox, EmailMessage message) => outbox.Add(EmailOutboxHandler.MessageType, message);
}
