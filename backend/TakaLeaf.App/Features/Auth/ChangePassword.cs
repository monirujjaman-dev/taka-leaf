using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// POST /api/auth/change-password - from Settings. Needs the current password. Keeps this
/// session signed in and signs out every other one.
/// </summary>
public static class ChangePassword
{
    public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

    public static RouteGroupBuilder MapChangePassword(this RouteGroupBuilder group)
    {
        group.MapPost("/change-password", Handle).WithName("ChangePassword").RequireAuthorization();
        return group;
    }

    private static async Task<IResult> Handle(
        ChangePasswordRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        IPasswordHasher<User> hasher,
        PasswordEmails emails,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var sessionId = principal.SessionId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return Results.Unauthorized();
        }

        var current = hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword ?? "");
        if (current == PasswordVerificationResult.Failed)
        {
            return ValidationErrors.For("currentPassword", "Your current password is not right.");
        }

        if (PasswordRules.Check(request.NewPassword, user.Email) is { } passwordProblem)
        {
            return ValidationErrors.For("newPassword", passwordProblem);
        }

        if (request.NewPassword == request.CurrentPassword)
        {
            return ValidationErrors.For("newPassword", "Choose a password different from the current one.");
        }

        var now = clock.GetUtcNow();
        user.PasswordHash = hasher.HashPassword(user, request.NewPassword!);

        var otherSessions = await db.Sessions
            .Where(s => s.UserId == user.Id && s.Id != sessionId && s.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var session in otherSessions)
        {
            session.RevokedAt = now;
        }

        // Any reset link sent earlier stops working too.
        var resetLinks = await db.UserTokens
            .Where(t => t.UserId == user.Id && t.Purpose == UserTokenPurpose.ResetPassword && t.UsedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var link in resetLinks)
        {
            link.UsedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        await emails.SendPasswordChangedAsync(user, cancellationToken);
        return Results.Ok(new MessageResponse("Your password is changed. You stay signed in here; other devices are signed out."));
    }
}
