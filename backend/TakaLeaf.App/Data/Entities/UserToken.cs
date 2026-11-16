namespace TakaLeaf.App.Data.Entities;

public enum UserTokenPurpose
{
    VerifyEmail,
    ResetPassword,
}

/// <summary>
/// A single-use link sent by email. Only its SHA-256 hash is stored.
/// </summary>
public sealed class UserToken
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public UserTokenPurpose Purpose { get; set; }
    public string TokenHash { get; set; } = "";

    /// <summary>
    /// For email verification: the password chosen at the registration that sent this link.
    /// It becomes the account's password when this link is opened, so a stranger who registers
    /// the same unverified email cannot end up owning the account once the real owner verifies.
    /// </summary>
    public string? PasswordHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
}
