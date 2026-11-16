using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Tests.Data;

[Collection(DatabaseCollection.Name)]
public class AppDbContextTests(DatabaseFixture fixture)
{
    private AsyncServiceScope NewScope(out AppDbContext db)
    {
        var scope = fixture.Factory.Services.CreateAsyncScope();
        db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return scope;
    }

    [Fact]
    public async Task Saving_stamps_timestamps_and_an_increasing_server_seq()
    {
        await using var scope = NewScope(out var db);
        var user = DatabaseFixture.NewUser();
        var wallet = new Wallet { UserId = user.Id, Type = WalletType.Cash, Name = "Cash", OpeningBalance = 500000 };
        db.AddRange(user, wallet);

        await db.SaveChangesAsync();

        Assert.NotEqual(default, wallet.CreatedAt);
        Assert.Equal(wallet.CreatedAt, wallet.UpdatedAt);
        Assert.True(wallet.ServerSeq > 0);
        var firstSeq = wallet.ServerSeq;
        var createdAt = wallet.CreatedAt;

        wallet.Name = "Pocket cash";
        await db.SaveChangesAsync();

        Assert.True(wallet.ServerSeq > firstSeq);
        Assert.Equal(createdAt, wallet.CreatedAt);
        Assert.True(wallet.UpdatedAt >= createdAt);
    }

    [Fact]
    public async Task Rows_saved_together_get_different_server_seq_numbers()
    {
        await using var scope = NewScope(out var db);
        var user = DatabaseFixture.NewUser();
        var cash = new Wallet { UserId = user.Id, Type = WalletType.Cash, Name = "Cash" };
        var bkash = new Wallet { UserId = user.Id, Type = WalletType.Mfs, Name = "bKash" };
        db.AddRange(user, cash, bkash);

        await db.SaveChangesAsync();

        Assert.NotEqual(cash.ServerSeq, bkash.ServerSeq);
    }

    [Fact]
    public async Task Soft_deleted_rows_are_hidden_but_kept()
    {
        await using var scope = NewScope(out var db);
        var user = DatabaseFixture.NewUser();
        var wallet = new Wallet { UserId = user.Id, Type = WalletType.Bank, Name = "Bank account" };
        db.AddRange(user, wallet);
        await db.SaveChangesAsync();

        wallet.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        Assert.False(await db.Wallets.AnyAsync(w => w.Id == wallet.Id));
        Assert.True(await db.Wallets.IgnoreQueryFilters().AnyAsync(w => w.Id == wallet.Id));
    }

    [Fact]
    public async Task A_transaction_amount_must_be_greater_than_zero()
    {
        await using var scope = NewScope(out var db);
        var user = DatabaseFixture.NewUser();
        var wallet = new Wallet { UserId = user.Id, Type = WalletType.Cash, Name = "Cash" };
        var expense = new Transaction
        {
            UserId = user.Id,
            Type = TransactionType.Expense,
            Amount = 0,
            FromWalletId = wallet.Id,
            OccurredAt = DateTimeOffset.UtcNow,
        };
        db.AddRange(user, wallet, expense);

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Two_users_cannot_share_an_email()
    {
        await using var scope = NewScope(out var db);
        var first = DatabaseFixture.NewUser();
        var second = DatabaseFixture.NewUser();
        second.Email = first.Email;
        db.AddRange(first, second);

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Theory]
    [InlineData(typeof(Wallet), "wallets")]
    [InlineData(typeof(Person), "people")]
    [InlineData(typeof(Category), "categories")]
    [InlineData(typeof(Transaction), "transactions")]
    [InlineData(typeof(User), "users")]
    public async Task Tables_use_snake_case_names(Type entity, string table)
    {
        await using var scope = NewScope(out var db);

        Assert.Equal(table, db.Model.FindEntityType(entity)!.GetTableName());
    }

    [Fact]
    public async Task Columns_use_snake_case_names()
    {
        await using var scope = NewScope(out var db);
        var property = db.Model.FindEntityType(typeof(Wallet))!.FindProperty(nameof(Wallet.OpeningBalance))!;

        Assert.Equal("opening_balance", property.GetColumnName());
    }
}
