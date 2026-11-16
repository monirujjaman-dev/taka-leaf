using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Email;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>Writes and sends the emails used by Register and ResendVerification.</summary>
public sealed class VerificationEmails(
    AppDbContext db,
    IEmailSender sender,
    IOptions<AppOptions> app,
    TimeProvider clock,
    ILogger<VerificationEmails> logger)
{
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromHours(24);

    private string WebBaseUrl => app.Value.WebBaseUrl.TrimEnd('/');

    /// <summary>Saves a new single-use link (with the password and name it will set) and emails it.</summary>
    public async Task SendVerificationAsync(User user, string passwordHash, string name, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var token = SecureToken.Create();
        db.UserTokens.Add(new UserToken
        {
            UserId = user.Id,
            Purpose = UserTokenPurpose.VerifyEmail,
            TokenHash = SecureToken.Hash(token),
            PasswordHash = passwordHash,
            Name = name,
            CreatedAt = now,
            ExpiresAt = now + LinkLifetime,
        });
        await db.SaveChangesAsync(cancellationToken);

        var body = string.Join('\n',
            $"Welcome to TakaLeaf, {name}.",
            "",
            "Open this link to verify your email and finish creating your account:",
            $"{WebBaseUrl}/verify-email?token={token}",
            "",
            "The link works once and expires in 24 hours.",
            "If you did not create a TakaLeaf account, you can ignore this email.");
        await SendAsync(new EmailMessage(user.Email, "Verify your TakaLeaf email", body), cancellationToken);
    }

    /// <summary>Someone tried to register an email that already has a verified account.</summary>
    public async Task SendAlreadyRegisteredAsync(User user, CancellationToken cancellationToken)
    {
        var body = string.Join('\n',
            "Someone tried to create a TakaLeaf account with this email, but you already have one.",
            "",
            $"Sign in here: {WebBaseUrl}/sign-in",
            "If you forgot your password, choose \"Forgot password?\" on that page.",
            "",
            "If this was not you, you can ignore this email. Your account has not changed.");
        await SendAsync(new EmailMessage(user.Email, "You already have a TakaLeaf account", body), cancellationToken);
    }

    private async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await sender.SendAsync(message, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // The person can ask for the email again; a mail server problem must not lose the registration.
            logger.LogError(exception, "Could not send the email \"{Subject}\"", message.Subject);
        }
    }
}
