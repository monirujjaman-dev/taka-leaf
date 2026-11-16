using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>
/// GET /api/transactions - history, newest first, a page at a time. Filters: from and to (local
/// dates, both included), walletId, categoryId (a top-level category includes its sub-categories),
/// uncategorised (only rows with no category), type, and search (words in the note). Totals cover every matching row, not only this page;
/// transfers are neither income nor expense.
/// </summary>
public static class ListTransactions
{
    public const int DefaultPageSize = 50;
    public const int MaxPageSize = 200;

    public sealed record TransactionTotals(long Income, long Expense);

    public sealed record TransactionPage(
        IReadOnlyList<TransactionDto> Items, int TotalCount, int Page, int PageSize, TransactionTotals Totals);

    public static RouteGroupBuilder MapListTransactions(this RouteGroupBuilder group)
    {
        group.MapGet("/", Handle).WithName("ListTransactions");
        return group;
    }

    private static async Task<IResult> Handle(
        [AsParameters] TransactionFilter filter,
        int? page,
        int? pageSize,
        ClaimsPrincipal principal,
        AppDbContext db,
        LocalCalendar calendar,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var query = await filter.ApplyAsync(db, userId, calendar, cancellationToken);

        var totalCount = await query.CountAsync(cancellationToken);
        var income = await query.Where(t => t.Type == TransactionType.Income).SumAsync(t => (long?)t.Amount, cancellationToken) ?? 0;
        var expense = await query.Where(t => t.Type == TransactionType.Expense).SumAsync(t => (long?)t.Amount, cancellationToken) ?? 0;

        var size = Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize);
        var number = Math.Max(page ?? 1, 1);
        var rows = await query
            .OrderByDescending(t => t.OccurredAt)
            .ThenByDescending(t => t.CreatedAt)
            .Skip((number - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);

        var items = await TransactionRules.ToDtosAsync(db, userId, rows, cancellationToken);
        return Results.Ok(new TransactionPage(items, totalCount, number, size, new TransactionTotals(income, expense)));
    }
}
