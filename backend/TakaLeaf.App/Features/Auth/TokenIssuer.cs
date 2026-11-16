using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// Creates sessions, rotates refresh tokens and writes access tokens. Shared by the Login and
/// Refresh slices, so both answer in exactly the same shape.
/// </summary>
public sealed class TokenIssuer(AppDbContext db, IOptions<AuthOptions> options, TimeProvider clock)
{
    public const string RefreshCookie = "tl_refresh";
    private const string RefreshCookiePath = "/api/auth";
    private static readonly JsonWebTokenHandler Handler = new();

    public static TokenValidationParameters ValidationParameters(AuthOptions auth) => new()
    {
        ValidIssuer = AuthOptions.TokenIssuerName,
        ValidAudience = AuthOptions.TokenAudience,
        IssuerSigningKey = auth.CreateSigningKey(),
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = "sub",
    };

    public async Task<AuthResponse> StartSessionAsync(User user, bool web, HttpContext http, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var session = new Session
        {
            UserId = user.Id,
            CreatedAt = now,
            UserAgent = Truncate(http.Request.Headers.UserAgent.ToString(), 200),
        };
        db.Sessions.Add(session);
        var refreshToken = Rotate(session, now);
        await db.SaveChangesAsync(cancellationToken);
        return Respond(user, session, refreshToken, web, http);
    }

    /// <summary>Adds a new refresh token to the session and extends it. The caller saves.</summary>
    public string Rotate(Session session, DateTimeOffset now)
    {
        var raw = SecureToken.Create();
        session.LastUsedAt = now;
        session.ExpiresAt = now.AddDays(options.Value.RefreshTokenDays);
        db.RefreshTokens.Add(new RefreshToken { SessionId = session.Id, TokenHash = SecureToken.Hash(raw), CreatedAt = now });
        return raw;
    }

    public AuthResponse Respond(User user, Session session, string refreshToken, bool web, HttpContext http)
    {
        var now = clock.GetUtcNow();
        var expires = now.AddMinutes(options.Value.AccessTokenMinutes);
        var accessToken = Handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = AuthOptions.TokenIssuerName,
            Audience = AuthOptions.TokenAudience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            Claims = new Dictionary<string, object>
            {
                ["sub"] = user.Id.ToString(),
                ["sid"] = session.Id.ToString(),
                ["email"] = user.Email,
                ["jti"] = Guid.NewGuid().ToString(),
            },
            SigningCredentials = new SigningCredentials(options.Value.CreateSigningKey(), SecurityAlgorithms.HmacSha256),
        });

        if (web)
        {
            http.Response.Cookies.Append(RefreshCookie, refreshToken, RefreshCookieOptions(session.ExpiresAt));
        }

        return new AuthResponse(accessToken, expires, web ? null : refreshToken, AuthUser.From(user));
    }

    public static void ClearRefreshCookie(HttpContext http) =>
        http.Response.Cookies.Delete(RefreshCookie, RefreshCookieOptions(null));

    private static CookieOptions RefreshCookieOptions(DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = RefreshCookiePath,
        Expires = expires,
        IsEssential = true,
    };

    private static string? Truncate(string value, int max) =>
        string.IsNullOrEmpty(value) ? null : value.Length <= max ? value : value[..max];
}
