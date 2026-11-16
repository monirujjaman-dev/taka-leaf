using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Tests.Support;

namespace TakaLeaf.App.Tests.Data;

/// <summary>
/// One running app against a real PostgreSQL (the one from deploy/docker-compose.dev.yml locally,
/// the service container in CI), shared by every test that needs the database or the API.
/// Those tests sit in one collection, so they never start apps or migrate at the same time.
/// </summary>
public sealed class DatabaseFixture : IAsyncLifetime
{
    public TestApp Factory { get; } = new();

    public async Task InitializeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync() => await Factory.DisposeAsync();

    /// <summary>Every test makes its own user, so tests never see each other's rows.</summary>
    public static User NewUser() => new()
    {
        Email = $"{Guid.NewGuid():N}@example.test",
        PasswordHash = "not-a-real-hash",
        CreatedAt = DateTimeOffset.UtcNow,
    };
}

[CollectionDefinition(Name)]
public sealed class DatabaseCollection : ICollectionFixture<DatabaseFixture>
{
    public const string Name = "database";
}
