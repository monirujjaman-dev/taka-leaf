using System.Globalization;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Email;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>Writes and sends the emails used by ForgotPassword and ChangePassword.</summary>
public sealed class PasswordEmails(
    AppDbContext db,
    IEmailSender sender,
    EmailTemplates templates,
    LocalCalendar calendar,
    TimeProvider clock,
    ILogger<PasswordEmails> logger)
{
    public static readonly TimeSpan ResetLinkLifetime = TimeSpan.FromMinutes(30);

    /// <summary>Saves a single-use reset link and emails it.</summary>
    public async Task SendResetLinkAsync(User user, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var token = SecureToken.Create();
        db.UserTokens.Add(new UserToken
        {
            UserId = user.Id,
            Purpose = UserTokenPurpose.ResetPassword,
            TokenHash = SecureToken.Hash(token),
            CreatedAt = now,
            ExpiresAt = now + ResetLinkLifetime,
        });
        await db.SaveChangesAsync(cancellationToken);

        var message = templates.Render(
            "reset-password",
            user.Email,
            "Reset your TakaLeaf password",
            "Choose a new password. The link works for 30 minutes.",
            new Dictionary<string, string>
            {
                ["greeting"] = EmailTemplates.Greeting(user.Name),
                ["actionUrl"] = templates.Link($"/reset-password?token={token}"),
            });
        await SendAsync(message, cancellationToken);
    }

    /// <summary>Tells the owner that the password changed, in case it was not them.</summary>
    public async Task SendPasswordChangedAsync(User user, CancellationToken cancellationToken)
    {
        var message = templates.Render(
            "password-changed",
            user.Email,
            "Your TakaLeaf password was changed",
            "If this was not you, reset your password now.",
            new Dictionary<string, string>
            {
                ["greeting"] = EmailTemplates.Greeting(user.Name),
                ["when"] = When(clock.GetUtcNow()),
                ["actionUrl"] = templates.Link("/forgot-password"),
            });
        await SendAsync(message, cancellationToken);
    }

    /// <summary>"17 Nov 2026, 1:03 AM (Dhaka time)": the local time, as the apps show it.</summary>
    private string When(DateTimeOffset moment) =>
        calendar.ToLocal(moment).ToString("d MMM yyyy, h:mm tt", CultureInfo.InvariantCulture) + " (Dhaka time)";

    private async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await sender.SendAsync(message, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Could not send the email \"{Subject}\"", message.Subject);
        }
    }
}
