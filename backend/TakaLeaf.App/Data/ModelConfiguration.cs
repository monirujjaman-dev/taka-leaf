using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TakaLeaf.App.Common;
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
        builder.Property(e => e.Name).HasMaxLength(NameRules.MaxLength);
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
        builder.HasOne<RecurringRule>().WithMany().HasForeignKey(e => e.RecurringRuleId).OnDelete(DeleteBehavior.Restrict);

        // A recurring date is recorded at most once, even if two requests race.
        builder.HasIndex(e => new { e.RecurringRuleId, e.RecurringDate }).IsUnique().HasFilter("recurring_rule_id IS NOT NULL AND deleted_at IS NULL");

        builder.Property(e => e.LoanPart).HasConversion<string>().HasMaxLength(20);
        builder.HasOne<Loan>().WithMany().HasForeignKey(e => e.LoanId).OnDelete(DeleteBehavior.Restrict);

        // Each EMI of a loan is paid once: one principal row, one interest row, one fee row at most.
        builder.HasIndex(e => new { e.LoanId, e.LoanEmi, e.LoanPart }).IsUnique().HasFilter("loan_emi IS NOT NULL AND deleted_at IS NULL");
    }
}

internal sealed class LoanConfiguration : IEntityTypeConfiguration<Loan>
{
    public void Configure(EntityTypeBuilder<Loan> builder)
    {
        builder.ConfigureSynced();
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("ck_loans_principal_positive", "principal > 0");
            table.HasCheckConstraint("ck_loans_emi_positive", "emi > 0");
            table.HasCheckConstraint("ck_loans_months", "months BETWEEN 1 AND 600");
            table.HasCheckConstraint("ck_loans_rate", "rate_points BETWEEN 0 AND 10000");
        });
        builder.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Name).HasMaxLength(80);
        builder.Property(e => e.Lender).HasMaxLength(80);
        builder.HasOne<Wallet>().WithMany().HasForeignKey(e => e.WalletId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Wallet>().WithMany().HasForeignKey(e => e.PayFromWalletId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class BudgetConfiguration : IEntityTypeConfiguration<Budget>
{
    public void Configure(EntityTypeBuilder<Budget> builder)
    {
        builder.ConfigureSynced();
        builder.ToTable(table => table.HasCheckConstraint("ck_budgets_amount_positive", "amount > 0"));
        builder.HasOne<Category>().WithMany().HasForeignKey(e => e.CategoryId).OnDelete(DeleteBehavior.Restrict);

        // One budget per category, and one overall budget (null category), per user.
        builder.HasIndex(e => new { e.UserId, e.CategoryId }).IsUnique().HasFilter("deleted_at IS NULL").AreNullsDistinct(false);
    }
}

internal sealed class RecurringRuleConfiguration : IEntityTypeConfiguration<RecurringRule>
{
    public void Configure(EntityTypeBuilder<RecurringRule> builder)
    {
        builder.ConfigureSynced();
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("ck_recurring_rules_amount_positive", "amount > 0");
            table.HasCheckConstraint("ck_recurring_rules_interval", "interval BETWEEN 1 AND 366");
        });
        builder.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Frequency).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.HasOne<Wallet>().WithMany().HasForeignKey(e => e.FromWalletId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Wallet>().WithMany().HasForeignKey(e => e.ToWalletId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Category>().WithMany().HasForeignKey(e => e.CategoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(e => new { e.NextDate, e.AutoRecord });
    }
}

internal sealed class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.UserAgent).HasMaxLength(200);
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.TokenHash).HasMaxLength(64);
        builder.HasIndex(e => e.TokenHash).IsUnique();
        builder.HasOne<Session>().WithMany().HasForeignKey(e => e.SessionId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class UserTokenConfiguration : IEntityTypeConfiguration<UserToken>
{
    public void Configure(EntityTypeBuilder<UserToken> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Purpose).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.TokenHash).HasMaxLength(64);
        builder.Property(e => e.PasswordHash).HasMaxLength(500);
        builder.Property(e => e.Name).HasMaxLength(NameRules.MaxLength);
        builder.HasIndex(e => e.TokenHash).IsUnique();
        builder.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Type).HasMaxLength(50);
        builder.Property(e => e.LastError).HasMaxLength(2000);

        // The worker's query: messages still to do, oldest due first.
        builder.HasIndex(e => e.AvailableAt).HasFilter("processed_at IS NULL AND failed_at IS NULL");
    }
}
