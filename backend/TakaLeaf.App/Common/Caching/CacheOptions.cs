namespace TakaLeaf.App.Common.Caching;

/// <summary>Settings for caching the heavy read endpoints ("Cache" in appsettings).</summary>
public sealed class CacheOptions
{
    public const string Section = "Cache";

    /// <summary>Off: every read goes to PostgreSQL, as before caching existed.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>How long an entry may live in Redis. Writes remove a user's entries at once anyway.</summary>
    public int ExpirationMinutes { get; set; } = 30;

    /// <summary>How long an entry may live in this process's memory before Redis (or the database) is asked again.</summary>
    public int LocalExpirationMinutes { get; set; } = 5;
}
