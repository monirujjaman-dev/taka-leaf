using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// POST /api/auth/refresh - swaps a refresh token for a new access token and a new refresh token.
/// A refresh token works once. If an old one comes back later, it was probably copied, so the
/// whole session is ended.
/// </summary>
public static class Refresh
{
    // Two browser tabs can refresh at the same moment with the same cookie; that is not theft.
    public static readonly TimeSpan ReuseGrace = TimeSpan.FromSeconds(30);

    /// <param name="RefreshToken">Sent by the Android app. The web app sends {} and its cookie is used.</param>
    public sealed record RefreshRequest(string? RefreshToken);

    public static RouteGroupBuilder MapRefresh(this RouteGroupBuilder group)
    {
        group.MapPost("/refresh", Handle).WithName("RefreshToken").AllowAnonymous();
        return group;
    }

    private static async Task<IResult> Handle(
        RefreshRequest request,
        HttpContext http,
        AppDbContext db,
        TokenIssuer issuer,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var fromCookie = string.IsNullOrEmpty(request.RefreshToken);
        var presented = fromCookie ? http.Request.Cookies[TokenIssuer.RefreshCookie] : request.RefreshToken;
        if (string.IsNullOrEmpty(presented))
        {
            return SessionEnded(http, fromCookie);
        }

        var now = clock.GetUtcNow();
        var hash = SecureToken.Hash(presented);
        var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        if (token is null)
        {
            return SessionEnded(http, fromCookie);
        }

        var session = await db.Sessions.FirstAsync(s => s.Id == token.SessionId, cancellationToken);
        if (session.RevokedAt is not null || session.ExpiresAt <= now)
        {
            return SessionEnded(http, fromCookie);
        }

        if (token.UsedAt is { } usedAt)
        {
            if (now - usedAt <= ReuseGrace)
            {
                return Results.Problem(
                    title: "This session was refreshed a moment ago. Try again.",
                    statusCode: StatusCodes.Status409Conflict);
            }

            session.RevokedAt = now;
            await db.SaveChangesAsync(cancellationToken);
            return SessionEnded(http, fromCookie);
        }

        token.UsedAt = now;
        var nextToken = issuer.Rotate(session, now);
        await db.SaveChangesAsync(cancellationToken);

        var user = await db.Users.FirstAsync(u => u.Id == session.UserId, cancellationToken);
        return Results.Ok(issuer.Respond(user, session, nextToken, fromCookie, http));
    }

    private static IResult SessionEnded(HttpContext http, bool fromCookie)
    {
        if (fromCookie)
        {
            TokenIssuer.ClearRefreshCookie(http);
        }

        return Results.Problem(title: "Your session has ended. Sign in again.", statusCode: StatusCodes.Status401Unauthorized);
    }
}
