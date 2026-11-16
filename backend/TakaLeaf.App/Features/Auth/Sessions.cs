using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// Signed-in devices. GET /api/auth/sessions lists them; DELETE /api/auth/sessions/{id} signs one
/// out; POST /api/auth/sessions/sign-out-others signs out every device except this one. A
/// signed-out device is refused on its very next request (see SessionCheck), not after its access
/// token expires.
/// </summary>
public static class Sessions
{
    public sealed record SessionDto(Guid Id, string Device, DateTimeOffset SignedInAt, DateTimeOffset LastUsedAt, bool Current);

    public sealed record SignedOut(int Count);

    public static RouteGroupBuilder MapSessions(this RouteGroupBuilder group)
    {
        group.MapGet("/sessions", List).WithName("GetSessions").RequireAuthorization();
        group.MapDelete("/sessions/{id:guid}", SignOutOne).WithName("SignOutSession").RequireAuthorization();
        group.MapPost("/sessions/sign-out-others", SignOutOthers).WithName("SignOutOtherSessions").RequireAuthorization();
        return group;
    }

    private static async Task<IResult> List(ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var userId = principal.UserId();
        var current = principal.SessionId();
        var now = clock.GetUtcNow();
        var sessions = await db.Sessions
            .Where(s => s.UserId == userId && s.RevokedAt == null && s.ExpiresAt > now)
            .OrderByDescending(s => s.LastUsedAt)
            .ToListAsync(ct);
        return Results.Ok(sessions
            .Select(s => new SessionDto(s.Id, DeviceName.From(s.UserAgent), s.CreatedAt, s.LastUsedAt, s.Id == current))
            .OrderByDescending(s => s.Current)
            .ToList());
    }

    private static async Task<IResult> SignOutOne(Guid id, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var userId = principal.UserId();
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId && s.RevokedAt == null, ct);
        if (session is null)
        {
            return NotFound.Problem("Session");
        }

        session.RevokedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> SignOutOthers(ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var userId = principal.UserId();
        var current = principal.SessionId();
        var now = clock.GetUtcNow();
        var others = await db.Sessions.Where(s => s.UserId == userId && s.Id != current && s.RevokedAt == null).ToListAsync(ct);
        foreach (var session in others)
        {
            session.RevokedAt = now;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new SignedOut(others.Count));
    }
}

/// <summary>A readable name from a User-Agent: "Chrome on Windows", "TakaLeaf app on Android".</summary>
public static class DeviceName
{
    public static string From(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return "Unknown device";
        }

        var ua = userAgent;
        var app = ua.Contains("TakaLeaf", StringComparison.OrdinalIgnoreCase) ? "TakaLeaf app"
            : ua.Contains("Edg/", StringComparison.Ordinal) ? "Edge"
            : ua.Contains("OPR/", StringComparison.Ordinal) ? "Opera"
            : ua.Contains("Firefox/", StringComparison.Ordinal) ? "Firefox"
            : ua.Contains("SamsungBrowser/", StringComparison.Ordinal) ? "Samsung Internet"
            : ua.Contains("Chrome/", StringComparison.Ordinal) ? "Chrome"
            : ua.Contains("Safari/", StringComparison.Ordinal) ? "Safari"
            : "Browser";
        var system = ua.Contains("Android", StringComparison.Ordinal) ? "Android"
            : ua.Contains("iPhone", StringComparison.Ordinal) || ua.Contains("iPad", StringComparison.Ordinal) ? "iOS"
            : ua.Contains("Windows", StringComparison.Ordinal) ? "Windows"
            : ua.Contains("Mac OS X", StringComparison.Ordinal) || ua.Contains("Macintosh", StringComparison.Ordinal) ? "macOS"
            : ua.Contains("CrOS", StringComparison.Ordinal) ? "ChromeOS"
            : ua.Contains("Linux", StringComparison.Ordinal) ? "Linux"
            : null;
        return system is null ? app : $"{app} on {system}";
    }
}

/// <summary>
/// Runs after an access token's signature and lifetime check: the token's session must still be
/// active. Signing out, changing the password or signing out a device takes effect at once.
/// </summary>
public static class SessionCheck
{
    public static async Task ValidateAsync(Microsoft.AspNetCore.Authentication.JwtBearer.TokenValidatedContext context)
    {
        if (!Guid.TryParse(context.Principal?.FindFirst("sid")?.Value, out var sessionId))
        {
            context.Fail("The token has no session.");
            return;
        }

        var services = context.HttpContext.RequestServices;
        var db = services.GetRequiredService<AppDbContext>();
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow();
        var active = await db.Sessions.AnyAsync(
            s => s.Id == sessionId && s.RevokedAt == null && s.ExpiresAt > now, context.HttpContext.RequestAborted);
        if (!active)
        {
            context.Fail("The session has ended.");
        }
    }
}
