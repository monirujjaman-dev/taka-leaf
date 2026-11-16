using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Data;

internal static class SyncedEntityConfiguration
{
    /// <summary>What every synced table shares: owner, change index and the soft-delete filter.</summary>
    public static void ConfigureSynced<T>(this EntityTypeBuilder<T> builder)
        where T : SyncedEntity
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(e => new { e.UserId, e.ServerSeq });
        builder.HasQueryFilter(e => e.DeletedAt == null);
    }
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Email).HasMaxLength(254);
        builder.Property(e => e.PasswordHash).HasMaxLength(500);
        builder.HasIndex(e => e.Email).IsUnique();
    }
}

internal sealed class WalletConfiguration : IEntityTypeConfiguration<Wallet>
{
    public void Configure(EntityTypeBuilder<Wallet> builder)
    {
        builder.ConfigureSynced();
        builder.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Name).HasMaxLength(80);
        builder.Property(e => e.Icon).HasMaxLength(40);
        builder.Property(e => e.Color).HasMaxLength(20);
        builder.HasOne<Person>().WithMany().HasForeignKey(e => e.PersonId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class PersonConfiguration : IEntityTypeConfiguration<Person>
{
    public void Configure(EntityTypeBuilder<Person> builder)
    {
        builder.ConfigureSynced();
        builder.Property(e => e.Name).HasMaxLength(80);
        builder.Property(e => e.Note).HasMaxLength(500);
    }
}

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ConfigureSynced();
        builder.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Name).HasMaxLength(80);
        builder.Property(e => e.Icon).HasMaxLength(40);
        builder.Property(e => e.Color).HasMaxLength(20);
        builder.HasOne<Category>().WithMany().HasForeignKey(e => e.ParentId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.ConfigureSynced();
        builder.ToTable(table => table.HasCheckConstraint("ck_transactions_amount_positive", "amount > 0"));
        builder.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.HasOne<Wallet>().WithMany().HasForeignKey(e => e.FromWalletId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Wallet>().WithMany().HasForeignKey(e => e.ToWalletId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Category>().WithMany().HasForeignKey(e => e.CategoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Person>().WithMany().HasForeignKey(e => e.PersonId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Transaction>().WithMany().HasForeignKey(e => e.FeeOfId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(e => new { e.UserId, e.OccurredAt });
    }
}
