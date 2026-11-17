using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Caching;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Wallets;

/// <summary>
/// GET /api/wallets - every wallet with its balance, and the totals. Archived wallets are left
/// out of the list unless includeArchived=true, but always count in the totals, so archiving
/// never makes money disappear from the net balance.
/// </summary>
public static class GetWallets
{
    public static RouteGroupBuilder MapGetWallets(this RouteGroupBuilder group)
    {
        group.MapGet("/", Handle).WithName("GetWallets");
        return group;
    }

    private static async Task<IResult> Handle(
        bool? includeArchived,
        ClaimsPrincipal principal,
        AppDbContext db,
        UserDataCache cache,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var list = await cache.GetOrCreateAsync(userId, "wallets", ct => LoadAsync(db, userId, ct), cancellationToken);
        return Results.Ok(includeArchived == true ? list : list with { Wallets = list.Wallets.Where(w => !w.Archived).ToList() });
    }

    /// <summary>Every wallet with its balance, archived ones included; the endpoint filters.</summary>
    private static async ValueTask<WalletList> LoadAsync(AppDbContext db, Guid userId, CancellationToken cancellationToken)
    {
        var wallets = await db.Wallets
            .Where(w => w.UserId == userId)
            .OrderBy(w => w.SortOrder)
            .ThenBy(w => w.CreatedAt)
            .ToListAsync(cancellationToken);
        var movements = await Balances.MovementsAsync(db, userId, cancellationToken);

        var all = wallets.Select(w => WalletRules.ToDto(w, movements.GetValueOrDefault(w.Id))).ToList();
        var summary = Balances.Summarize(wallets, movements);
        return new WalletList(all, new WalletTotals(summary.Assets, summary.Liabilities, summary.Net));
    }
}
