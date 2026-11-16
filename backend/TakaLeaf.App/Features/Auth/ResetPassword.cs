using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// POST /api/auth/reset-password - opened from the reset link. Sets the new password and signs
/// the account out everywhere. Opening the link also proves the email, so an unverified account
/// becomes verified.
/// </summary>
public static class ResetPassword
{
    public sealed record ResetPasswordRequest(string? Token, string? Password);

    public static RouteGroupBuilder MapResetPassword(this RouteGroupBuilder group)
    {
        group.MapPost("/reset-password", Handle).WithName("ResetPassword").AllowAnonymous();
        return group;
    }

    private static async Task<IResult> Handle(
        ResetPasswordRequest request,
        AppDbContext db,
        IPasswordHasher<User> hasher,
        TimeProvider clock,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return InvalidLink();
        }

        var now = clock.GetUtcNow();
        var hash = SecureToken.Hash(request.Token);
        var token = await db.UserTokens.FirstOrDefaultAsync(
            t => t.TokenHash == hash && t.Purpose == UserTokenPurpose.ResetPassword, cancellationToken);
        if (token is null || token.UsedAt is not null || token.ExpiresAt <= now)
        {
            return InvalidLink();
        }

        var user = await db.Users.FirstAsync(u => u.Id == token.UserId, cancellationToken);
        if (PasswordRules.Check(request.Password, user.Email) is { } passwordProblem)
        {
            return ValidationErrors.For("password", passwordProblem);
        }

        user.PasswordHash = hasher.HashPassword(user, request.Password!);
        user.EmailVerifiedAt ??= now;
        user.FailedSignInCount = 0;
        user.LockedUntil = null;

        // Every open link for this account stops working, and every session ends.
        var openLinks = await db.UserTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var link in openLinks)
        {
            link.UsedAt = now;
        }

        var sessions = await db.Sessions
            .Where(s => s.UserId == user.Id && s.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions)
        {
            session.RevokedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        loggers.CreateLogger(typeof(ResetPassword)).LogInformation("Password reset for user {UserId}; {SessionCount} sessions ended", user.Id, sessions.Count);
        return Results.Ok(new MessageResponse("Your password is changed. Sign in with the new one."));
    }

    private static IResult InvalidLink() =>
        Results.Problem(title: "This link is invalid or has expired.", statusCode: StatusCodes.Status400BadRequest);
}
