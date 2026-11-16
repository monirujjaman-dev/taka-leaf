namespace TakaLeaf.App.Data.Entities;

/// <summary>
/// One signed-in browser or phone. A session holds a chain of refresh tokens; signing out
/// or detecting a stolen refresh token revokes the whole session.
/// </summary>
public sealed class Session
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset LastUsedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public string? UserAgent { get; set; }
}
