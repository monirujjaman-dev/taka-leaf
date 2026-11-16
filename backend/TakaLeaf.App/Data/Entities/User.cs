namespace TakaLeaf.App.Data.Entities;

public sealed class User
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>Always stored trimmed and lower-cased.</summary>
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public DateTimeOffset? EmailVerifiedAt { get; set; }
    public int FailedSignInCount { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
