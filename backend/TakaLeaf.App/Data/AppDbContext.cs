using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common.Caching;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Data;

/// <summary>
/// The one database context. Slices use it directly; there are no repository or service layers.
/// </summary>
public sealed partial class AppDbContext(DbContextOptions<AppDbContext> options, TimeProvider clock, UserDataCache cache)
    : DbContext(options)
{
    public const string ServerSeqSequence = "server_seq";

    public DbSet<User> Users => Set<User>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<RecurringRule> RecurringRules => Set<RecurringRule>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserToken> UserTokens => Set<UserToken>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasSequence<long>(ServerSeqSequence);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        UseSnakeCaseNames(modelBuilder);
    }

    /// <summary>
    /// Stamps every added or changed synced row with the time and the next server sequence
    /// number, so "what changed since X" is always answerable, and then drops the cached read
    /// answers of every user whose rows changed.
    /// </summary>
    /// <remarks>
    /// A user's saves are serialised with a transaction-level advisory lock taken before the
    /// sequence numbers, so they commit in ServerSeq order. Without it a save that took number 10
    /// could commit after one that took 11, and a sync pull that had already moved its cursor past
    /// 11 would never see row 10.
    /// </remarks>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var stamping = ChangeTracker.Entries<SyncedEntity>().Any(entry => entry.State is EntityState.Added or EntityState.Modified);
        if (!stamping || Database.CurrentTransaction is not null)
        {
            return await StampAndSaveAsync(cancellationToken);
        }

        await using var transaction = await Database.BeginTransactionAsync(cancellationToken);
        var saved = await StampAndSaveAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return saved;
    }

    private async Task<int> StampAndSaveAsync(CancellationToken cancellationToken)
    {
        var changed = ChangeTracker.Entries<SyncedEntity>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified)
            .ToList();
        var users = ChangeTracker.Entries<SyncedEntity>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(entry => entry.Entity.UserId)
            .ToHashSet();

        if (changed.Count > 0)
        {
            foreach (var user in changed.Select(entry => entry.Entity.UserId).Distinct().Order())
            {
                var key = user.ToString();
                await Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", cancellationToken);
            }

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

        var saved = await base.SaveChangesAsync(cancellationToken);

        // Cached dashboards, balances and reports of these users are now out of date.
        await cache.InvalidateAsync(users, CancellationToken.None);
        return saved;
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
