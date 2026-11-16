using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// POST /api/auth/logout - ends this session. Its refresh token stops working at once; the
/// short-lived access token expires on its own within minutes.
/// </summary>
public static class Logout
{
    public static RouteGroupBuilder MapLogout(this RouteGroupBuilder group)
    {
        group.MapPost("/logout", Handle).WithName("Logout").RequireAuthorization();
        return group;
    }

    private static async Task<IResult> Handle(
        ClaimsPrincipal principal,
        HttpContext http,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var sessionId = principal.SessionId();
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);
        if (session is { RevokedAt: null })
        {
            session.RevokedAt = clock.GetUtcNow();
            await db.SaveChangesAsync(cancellationToken);
        }

        TokenIssuer.ClearRefreshCookie(http);
        return Results.NoContent();
    }
}
