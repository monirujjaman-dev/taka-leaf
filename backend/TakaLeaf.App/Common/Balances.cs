using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Common;

/// <summary>
/// Balances are never stored. A wallet's balance is its opening balance plus every amount that
/// arrived in it minus every amount that left it. Deleted transactions do not count.
/// </summary>
/// <summary>Assets are positive balances and liabilities negative ones, both from wallets counted in the total.</summary>
public sealed record MoneySummary(long Assets, long Liabilities, long Net, long OwedToMe, long IOwe);

public static class Balances
{
    /// <summary>
    /// Totals across wallets. Archived wallets count; wallets hidden from the total do not.
    /// Lent wallets hold what people owe the user, borrowed wallets (negative) what the user owes.
    /// </summary>
    public static MoneySummary Summarize(IEnumerable<Wallet> wallets, IReadOnlyDictionary<Guid, long> movements)
    {
        long assets = 0, liabilities = 0, owedToMe = 0, iOwe = 0;
        foreach (var wallet in wallets)
        {
            var balance = wallet.OpeningBalance + movements.GetValueOrDefault(wallet.Id);
            if (wallet.Type == WalletType.Lent && balance > 0)
            {
                owedToMe += balance;
            }

            if (wallet.Type == WalletType.Borrowed && balance < 0)
            {
                iOwe -= balance;
            }

            if (wallet.ExcludedFromTotal)
            {
                continue;
            }

            if (balance > 0)
            {
                assets += balance;
            }
            else
            {
                liabilities -= balance;
            }
        }

        return new MoneySummary(assets, liabilities, assets - liabilities, owedToMe, iOwe);
    }

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
