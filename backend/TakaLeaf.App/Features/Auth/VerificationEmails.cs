using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Email;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>Writes and sends the emails used by Register and ResendVerification.</summary>
public sealed class VerificationEmails(
    AppDbContext db,
    IEmailSender sender,
    EmailTemplates templates,
    TimeProvider clock,
    ILogger<VerificationEmails> logger)
{
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromHours(24);

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

        var message = templates.Render(
            "verify-email",
            user.Email,
            "Verify your TakaLeaf email",
            "Finish creating your account. The link works for 24 hours.",
            new Dictionary<string, string>
            {
                ["greeting"] = EmailTemplates.Greeting(name),
                ["actionUrl"] = templates.Link($"/verify-email?token={token}"),
            });
        await SendAsync(message, cancellationToken);
    }

    /// <summary>Someone tried to register an email that already has a verified account.</summary>
    public async Task SendAlreadyRegisteredAsync(User user, CancellationToken cancellationToken)
    {
        var message = templates.Render(
            "already-registered",
            user.Email,
            "You already have a TakaLeaf account",
            "Someone tried to sign up with your email. Your account has not changed.",
            new Dictionary<string, string>
            {
                ["greeting"] = EmailTemplates.Greeting(user.Name),
                ["actionUrl"] = templates.Link("/sign-in"),
                ["resetUrl"] = templates.Link("/forgot-password"),
            });
        await SendAsync(message, cancellationToken);
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
