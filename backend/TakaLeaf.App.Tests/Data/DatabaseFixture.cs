using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Tests.Data;

/// <summary>
/// Starts the app against a real PostgreSQL (the one from deploy/docker-compose.dev.yml locally,
/// the service container in CI) and applies the migrations once for all database tests.
/// </summary>
public sealed class DatabaseFixture : IAsyncLifetime
{
    public WebApplicationFactory<Program> Factory { get; } = new();

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
