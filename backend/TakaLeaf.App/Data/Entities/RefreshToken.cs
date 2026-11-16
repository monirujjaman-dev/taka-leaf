namespace TakaLeaf.App.Data.Entities;

/// <summary>
/// A refresh token is used exactly once and replaced by a new one. Only its SHA-256 hash is stored.
/// </summary>
public sealed class RefreshToken
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid SessionId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
}
