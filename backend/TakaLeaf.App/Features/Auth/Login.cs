using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// POST /api/auth/login - signs in with email and password. Five wrong passwords lock the
/// account's sign-in for 15 minutes.
/// </summary>
public static class Login
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    // Checked when the email is unknown, so a wrong email takes as long as a wrong password.
    private static readonly string TimingHash = new PasswordHasher<User>().HashPassword(new User(), "takaleaf-timing-only");

    /// <param name="Client">"web" (default) puts the refresh token in a cookie; "mobile" returns it in the body.</param>
    public sealed record LoginRequest(string? Email, string? Password, string? Client);

    public static RouteGroupBuilder MapLogin(this RouteGroupBuilder group)
    {
        group.MapPost("/login", Handle).WithName("Login").AllowAnonymous();
        return group;
    }

    private static async Task<IResult> Handle(
        LoginRequest request,
        HttpContext http,
        AppDbContext db,
        IPasswordHasher<User> hasher,
        TokenIssuer issuer,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var password = request.Password ?? "";

        User? user = null;
        if (EmailRules.TryNormalize(request.Email, out var email))
        {
            user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
        }

        if (user is null)
        {
            hasher.VerifyHashedPassword(new User(), TimingHash, password);
            return WrongEmailOrPassword();
        }

        if (user.LockedUntil is { } lockedUntil && lockedUntil > now)
        {
            var minutes = Math.Max(1, (int)Math.Ceiling((lockedUntil - now).TotalMinutes));
            return Results.Problem(
                title: $"Too many wrong passwords. Try again in {minutes} minutes.",
                statusCode: StatusCodes.Status429TooManyRequests);
        }

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed)
        {
            user.FailedSignInCount++;
            if (user.FailedSignInCount >= MaxFailedAttempts)
            {
                user.LockedUntil = now + LockoutDuration;
                user.FailedSignInCount = 0;
            }

            await db.SaveChangesAsync(cancellationToken);
            return WrongEmailOrPassword();
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, password);
        }

        user.FailedSignInCount = 0;
        user.LockedUntil = null;

        if (user.EmailVerifiedAt is null)
        {
            await db.SaveChangesAsync(cancellationToken);
            return Results.Problem(
                title: "Verify your email before signing in.",
                statusCode: StatusCodes.Status403Forbidden,
                extensions: new Dictionary<string, object?> { ["code"] = "email_not_verified" });
        }

        var web = !string.Equals(request.Client, "mobile", StringComparison.OrdinalIgnoreCase);
        var response = await issuer.StartSessionAsync(user, web, http, cancellationToken);
        return Results.Ok(response);
    }

    private static IResult WrongEmailOrPassword() =>
        Results.Problem(title: "Email or password is incorrect.", statusCode: StatusCodes.Status401Unauthorized);
}
