using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Sync;

/// <summary>
/// GET /api/sync/pull?cursor=N&amp;protocol=1 - every row of the account changed after the cursor,
/// deleted rows included, oldest first, at most one page. A new phone starts from cursor 0.
/// </summary>
public static class PullChanges
{
    public static RouteGroupBuilder MapPullChanges(this RouteGroupBuilder group)
    {
        group.MapGet("/pull", Handle).WithName("SyncPull");
        return group;
    }

    private static async Task<IResult> Handle(
        long? cursor,
        int? protocol,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        if (SyncRules.ProtocolProblem(protocol) is { } problem)
        {
            return problem;
        }

        if (cursor is < 0)
        {
            return ValidationErrors.For("cursor", "The cursor is zero or more.");
        }

        var userId = principal.UserId();
        var after = cursor ?? 0;
        var take = SyncRules.PageSize + 1;

        // Each table's next rows; the page is the oldest PageSize of them all. Saves of one user
        // commit in ServerSeq order (see AppDbContext), so nothing below the cursor can still appear.
        var wallets = await Changed(db.Wallets, userId, after, take).ToListAsync(cancellationToken);
        var categories = await Changed(db.Categories, userId, after, take).ToListAsync(cancellationToken);
        var people = await Changed(db.People, userId, after, take).ToListAsync(cancellationToken);
        var transactions = await Changed(db.Transactions, userId, after, take).ToListAsync(cancellationToken);
        var budgets = await Changed(db.Budgets, userId, after, take).ToListAsync(cancellationToken);
        var rules = await Changed(db.RecurringRules, userId, after, take).ToListAsync(cancellationToken);

        var sequence = wallets.Select(r => r.ServerSeq)
            .Concat(categories.Select(r => r.ServerSeq))
            .Concat(people.Select(r => r.ServerSeq))
            .Concat(transactions.Select(r => r.ServerSeq))
            .Concat(budgets.Select(r => r.ServerSeq))
            .Concat(rules.Select(r => r.ServerSeq))
            .Order()
            .ToList();
        var hasMore = sequence.Count > SyncRules.PageSize;
        var last = sequence.Count == 0 ? after : sequence[Math.Min(sequence.Count, SyncRules.PageSize) - 1];

        return Results.Ok(new PullResponse(
            last,
            hasMore,
            wallets.Where(r => r.ServerSeq <= last).Select(SyncRules.ToRow).ToList(),
            categories.Where(r => r.ServerSeq <= last).Select(SyncRules.ToRow).ToList(),
            people.Where(r => r.ServerSeq <= last).Select(SyncRules.ToRow).ToList(),
            transactions.Where(r => r.ServerSeq <= last).Select(SyncRules.ToRow).ToList(),
            budgets.Where(r => r.ServerSeq <= last).Select(SyncRules.ToRow).ToList(),
            rules.Where(r => r.ServerSeq <= last).Select(SyncRules.ToRow).ToList()));
    }

    private static IQueryable<T> Changed<T>(DbSet<T> set, Guid userId, long after, int take)
        where T : SyncedEntity =>
        set.IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.UserId == userId && r.ServerSeq > after)
            .OrderBy(r => r.ServerSeq)
            .Take(take);
}
