using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>The signed-in person. Name is "" for accounts made before names were asked for.</summary>
public sealed record AuthUser(Guid Id, string Email, string Name)
{
    public static AuthUser From(User user) => new(user.Id, user.Email, user.Name);
}

/// <summary>
/// What a successful sign-in or refresh returns. The web app gets its refresh token in an
/// HttpOnly cookie, so RefreshToken is null for it; the Android app (version 2) gets it here.
/// </summary>
public sealed record AuthResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string? RefreshToken, AuthUser User);

public sealed record MessageResponse(string Message);
