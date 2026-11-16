using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Data;

/// <summary>
/// The one database context. Slices use it directly; there are no repository or service layers.
/// </summary>
public sealed partial class AppDbContext(DbContextOptions<AppDbContext> options, TimeProvider clock)
    : DbContext(options)
{
    public const string ServerSeqSequence = "server_seq";

    public DbSet<User> Users => Set<User>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserToken> UserTokens => Set<UserToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasSequence<long>(ServerSeqSequence);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        UseSnakeCaseNames(modelBuilder);
    }

    /// <summary>
    /// Stamps every added or changed synced row with the time and the next server sequence
    /// number, so "what changed since X" is always answerable.
    /// </summary>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var changed = ChangeTracker.Entries<SyncedEntity>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified)
            .ToList();

        if (changed.Count > 0)
        {
            var now = clock.GetUtcNow();
            var count = changed.Count;
            var sequenceNumbers = await Database
                .SqlQuery<long>($"SELECT nextval('server_seq') AS \"Value\" FROM generate_series(1, {count})")
                .ToListAsync(cancellationToken);

            for (var i = 0; i < changed.Count; i++)
            {
                var entry = changed[i];
                if (entry.State == EntityState.Added)
                {
                    entry.Entity.CreatedAt = now;
                }

                entry.Entity.UpdatedAt = now;
                entry.Entity.ServerSeq = sequenceNumbers[i];
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges() =>
        throw new NotSupportedException("Use SaveChangesAsync so synced rows get their server sequence number.");

    /// <summary>PostgreSQL convention: wallets.opening_balance, not "Wallets"."OpeningBalance".</summary>
    private static void UseSnakeCaseNames(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            if (entity.GetTableName() is { } table)
            {
                entity.SetTableName(ToSnakeCase(table));
            }

            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }

            foreach (var key in entity.GetKeys())
            {
                if (key.GetName() is { } name)
                {
                    key.SetName(ToSnakeCase(name));
                }
            }

            foreach (var foreignKey in entity.GetForeignKeys())
            {
                if (foreignKey.GetConstraintName() is { } name)
                {
                    foreignKey.SetConstraintName(ToSnakeCase(name));
                }
            }

            foreach (var index in entity.GetIndexes())
            {
                if (index.GetDatabaseName() is { } name)
                {
                    index.SetDatabaseName(ToSnakeCase(name));
                }
            }
        }
    }

    internal static string ToSnakeCase(string name) => WordBoundary().Replace(name, "_$1").ToLowerInvariant();

    [GeneratedRegex("(?<=[a-z0-9])([A-Z])")]
    private static partial Regex WordBoundary();
}
