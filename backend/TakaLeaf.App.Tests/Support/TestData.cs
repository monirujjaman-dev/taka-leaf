using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Tests.Data;

namespace TakaLeaf.App.Tests.Support;

/// <summary>
/// Puts rows straight into the database for tests that need them before their own API exists
/// (transactions come in the next slice).
/// </summary>
public sealed class TestData(DatabaseFixture fixture)
{
    public async Task<Guid> AddTransaction(
        Guid userId,
        TransactionType type,
        long amount,
        Guid? from = null,
        Guid? to = null,
        Guid? categoryId = null)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transaction = new Transaction
        {
            UserId = userId,
            Type = type,
            Amount = amount,
            FromWalletId = from,
            ToWalletId = to,
            CategoryId = categoryId,
            OccurredAt = DateTimeOffset.UtcNow,
        };
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();
        return transaction.Id;
    }
}
