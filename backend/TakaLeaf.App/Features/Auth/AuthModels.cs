namespace TakaLeaf.App.Features.Auth;

public sealed record AuthUser(Guid Id, string Email);

/// <summary>
/// What a successful sign-in or refresh returns. The web app gets its refresh token in an
/// HttpOnly cookie, so RefreshToken is null for it; the Android app (version 2) gets it here.
/// </summary>
public sealed record AuthResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string? RefreshToken, AuthUser User);

public sealed record MessageResponse(string Message);
