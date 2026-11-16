using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>POST /api/auth/verify-email - opened from the link in the verification email.</summary>
public static class VerifyEmail
{
    public sealed record VerifyEmailRequest(string? Token);

    public static RouteGroupBuilder MapVerifyEmail(this RouteGroupBuilder group)
    {
        group.MapPost("/verify-email", Handle).WithName("VerifyEmail").AllowAnonymous();
        return group;
    }

    private static async Task<IResult> Handle(
        VerifyEmailRequest request,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return InvalidLink();
        }

        var now = clock.GetUtcNow();
        var hash = SecureToken.Hash(request.Token);
        var token = await db.UserTokens.FirstOrDefaultAsync(
            t => t.TokenHash == hash && t.Purpose == UserTokenPurpose.VerifyEmail, cancellationToken);

        if (token is null || token.UsedAt is not null || token.ExpiresAt <= now)
        {
            return InvalidLink();
        }

        var user = await db.Users.FirstAsync(u => u.Id == token.UserId, cancellationToken);
        if (token.PasswordHash is not null)
        {
            user.PasswordHash = token.PasswordHash;
        }

        if (!string.IsNullOrEmpty(token.Name))
        {
            user.Name = token.Name;
        }

        user.EmailVerifiedAt ??= now;

        // Every other verification link for this account stops working now.
        var openLinks = await db.UserTokens
            .Where(t => t.UserId == user.Id && t.Purpose == UserTokenPurpose.VerifyEmail && t.UsedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var link in openLinks)
        {
            link.UsedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new MessageResponse("Your email is verified. You can sign in now."));
    }

    private static IResult InvalidLink() =>
        Results.Problem(title: "This link is invalid or has expired.", statusCode: StatusCodes.Status400BadRequest);
}
