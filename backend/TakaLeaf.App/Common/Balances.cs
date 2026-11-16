using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Common;

/// <summary>
/// Balances are never stored. A wallet's balance is its opening balance plus every amount that
/// arrived in it minus every amount that left it. Deleted transactions do not count.
/// </summary>
public static class Balances
{
    /// <summary>Money in minus money out, per wallet, for one user. Wallets with no transactions are absent.</summary>
    public static async Task<Dictionary<Guid, long>> MovementsAsync(AppDbContext db, Guid userId, CancellationToken cancellationToken)
    {
        var incoming = await db.Transactions
            .Where(t => t.UserId == userId && t.ToWalletId != null)
            .GroupBy(t => t.ToWalletId)
            .Select(g => new { WalletId = g.Key, Sum = g.Sum(t => t.Amount) })
            .ToListAsync(cancellationToken);
        var outgoing = await db.Transactions
            .Where(t => t.UserId == userId && t.FromWalletId != null)
            .GroupBy(t => t.FromWalletId)
            .Select(g => new { WalletId = g.Key, Sum = g.Sum(t => t.Amount) })
            .ToListAsync(cancellationToken);

        var movements = new Dictionary<Guid, long>();
        foreach (var row in incoming)
        {
            var id = row.WalletId!.Value;
            movements[id] = movements.GetValueOrDefault(id) + row.Sum;
        }

        foreach (var row in outgoing)
        {
            var id = row.WalletId!.Value;
            movements[id] = movements.GetValueOrDefault(id) - row.Sum;
        }

        return movements;
    }
}
