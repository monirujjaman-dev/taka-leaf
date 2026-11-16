namespace TakaLeaf.App.Data.Entities;

public sealed class User
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>Always stored trimmed and lower-cased.</summary>
    public string Email { get; set; } = "";

    /// <summary>What the apps call the account holder. Accounts made before names were asked for have "".</summary>
    public string Name { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public DateTimeOffset? EmailVerifiedAt { get; set; }
    public int FailedSignInCount { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
