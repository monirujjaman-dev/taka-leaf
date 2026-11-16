using Microsoft.EntityFrameworkCore;

namespace TakaLeaf.App.Data;

/// <summary>
/// The one database context. Slices use it directly; there are no repository or service layers.
/// Entities and the first migration are added in milestone M1.
/// </summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
