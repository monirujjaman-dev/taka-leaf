using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Email;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>Writes and sends the emails used by ForgotPassword and ChangePassword.</summary>
public sealed class PasswordEmails(
    AppDbContext db,
    IEmailSender sender,
    IOptions<AppOptions> app,
    TimeProvider clock,
    ILogger<PasswordEmails> logger)
{
    public static readonly TimeSpan ResetLinkLifetime = TimeSpan.FromMinutes(30);

    private string WebBaseUrl => app.Value.WebBaseUrl.TrimEnd('/');

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

        var body = string.Join('\n',
            "Someone asked to reset the password of your TakaLeaf account.",
            "",
            "Open this link to choose a new password:",
            $"{WebBaseUrl}/reset-password?token={token}",
            "",
            "The link works once and expires in 30 minutes.",
            "If you did not ask for this, you can ignore this email. Your password has not changed.");
        await SendAsync(new EmailMessage(user.Email, "Reset your TakaLeaf password", body), cancellationToken);
    }

    /// <summary>Tells the owner that the password changed, in case it was not them.</summary>
    public async Task SendPasswordChangedAsync(User user, CancellationToken cancellationToken)
    {
        var body = string.Join('\n',
            "The password of your TakaLeaf account was just changed.",
            "",
            "If this was you, there is nothing to do.",
            $"If it was not, reset your password now: {WebBaseUrl}/forgot-password");
        await SendAsync(new EmailMessage(user.Email, "Your TakaLeaf password was changed", body), cancellationToken);
    }

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
