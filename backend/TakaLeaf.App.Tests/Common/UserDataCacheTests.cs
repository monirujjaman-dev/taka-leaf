using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TakaLeaf.App.Common.Caching;

namespace TakaLeaf.App.Tests.Common;

public class UserDataCacheTests
{
    private static UserDataCache NewCache(bool enabled = true)
    {
        var services = new ServiceCollection();
        services.AddHybridCache();
        var provider = services.BuildServiceProvider();
        return new UserDataCache(provider.GetRequiredService<HybridCache>(), Options.Create(new CacheOptions { Enabled = enabled }));
    }

    private sealed class Counter
    {
        public int Calls;

        public ValueTask<int> Next(CancellationToken _) => ValueTask.FromResult(++Calls);
    }

    [Fact]
    public async Task The_second_read_comes_from_the_cache()
    {
        var cache = NewCache();
        var user = Guid.NewGuid();
        var counter = new Counter();

        Assert.Equal(1, await cache.GetOrCreateAsync(user, "dashboard:2026-11", counter.Next, CancellationToken.None));
        Assert.Equal(1, await cache.GetOrCreateAsync(user, "dashboard:2026-11", counter.Next, CancellationToken.None));
        Assert.Equal(1, counter.Calls);
    }

    [Fact]
    public async Task Invalidating_a_user_drops_all_their_entries_and_no_one_elses()
    {
        var cache = NewCache();
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();
        var mine = new Counter();
        var theirs = new Counter();
        await cache.GetOrCreateAsync(me, "wallets", mine.Next, CancellationToken.None);
        await cache.GetOrCreateAsync(me, "people", mine.Next, CancellationToken.None);
        await cache.GetOrCreateAsync(other, "wallets", theirs.Next, CancellationToken.None);

        await cache.InvalidateAsync([me], CancellationToken.None);

        Assert.Equal(3, await cache.GetOrCreateAsync(me, "wallets", mine.Next, CancellationToken.None));
        Assert.Equal(4, await cache.GetOrCreateAsync(me, "people", mine.Next, CancellationToken.None));
        Assert.Equal(1, await cache.GetOrCreateAsync(other, "wallets", theirs.Next, CancellationToken.None));
    }

    [Fact]
    public async Task The_same_key_for_two_users_is_two_entries()
    {
        var cache = NewCache();
        var counter = new Counter();

        await cache.GetOrCreateAsync(Guid.NewGuid(), "wallets", counter.Next, CancellationToken.None);
        await cache.GetOrCreateAsync(Guid.NewGuid(), "wallets", counter.Next, CancellationToken.None);

        Assert.Equal(2, counter.Calls);
    }

    [Fact]
    public async Task Switched_off_it_always_asks_the_database()
    {
        var cache = NewCache(enabled: false);
        var user = Guid.NewGuid();
        var counter = new Counter();

        await cache.GetOrCreateAsync(user, "wallets", counter.Next, CancellationToken.None);
        await cache.GetOrCreateAsync(user, "wallets", counter.Next, CancellationToken.None);

        Assert.Equal(2, counter.Calls);
    }
}
