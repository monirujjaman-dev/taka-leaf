using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Options;

namespace TakaLeaf.App.Common.Caching;

/// <summary>
/// Caches the answers of the heavy read endpoints (dashboard, wallets, people, budgets, reports,
/// categories) per user: in memory first, then Redis when <c>ConnectionStrings:Redis</c> is set.
/// Every entry carries its user's tag, and <see cref="Data.AppDbContext"/> removes that tag after
/// any save that changes one of the user's rows, so a cached answer is never older than the data.
/// </summary>
public sealed class UserDataCache(HybridCache cache, IOptions<CacheOptions> options)
{
    private readonly HybridCacheEntryOptions entryOptions = new()
    {
        Expiration = TimeSpan.FromMinutes(Math.Max(1, options.Value.ExpirationMinutes)),
        LocalCacheExpiration = TimeSpan.FromMinutes(Math.Clamp(options.Value.LocalExpirationMinutes, 1, Math.Max(1, options.Value.ExpirationMinutes))),
    };

    public static string Tag(Guid userId) => $"user:{userId:N}";

    /// <summary>The cached answer for this user and key, or the factory's answer (then cached).</summary>
    public async ValueTask<T> GetOrCreateAsync<T>(Guid userId, string key, Func<CancellationToken, ValueTask<T>> factory, CancellationToken cancellationToken)
    {
        if (!options.Value.Enabled)
        {
            return await factory(cancellationToken);
        }

        return await cache.GetOrCreateAsync(
            $"takaleaf:{userId:N}:{key}",
            factory,
            static (f, ct) => f(ct),
            entryOptions,
            [Tag(userId)],
            cancellationToken);
    }

    /// <summary>Drops every cached answer for these users.</summary>
    public async Task InvalidateAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        if (!options.Value.Enabled || userIds.Count == 0)
        {
            return;
        }

        await cache.RemoveByTagAsync(userIds.Select(Tag), cancellationToken);
    }
}
