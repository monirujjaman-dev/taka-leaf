using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>
/// GET /api/transactions - history, newest first, a page at a time. Filters: from and to (local
/// dates, both included), walletId, categoryId (a top-level category includes its sub-categories),
/// type, and search (words in the note). Totals cover every matching row, not only this page;
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
        DateOnly? from,
        DateOnly? to,
        Guid? walletId,
        Guid? categoryId,
        TransactionType? type,
        string? search,
        int? page,
        int? pageSize,
        ClaimsPrincipal principal,
        AppDbContext db,
        LocalCalendar calendar,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var query = db.Transactions.Where(t => t.UserId == userId);

        if (from is { } firstDay)
        {
            var start = calendar.StartOf(firstDay);
            query = query.Where(t => t.OccurredAt >= start);
        }

        if (to is { } lastDay)
        {
            var end = calendar.StartOf(lastDay.AddDays(1));
            query = query.Where(t => t.OccurredAt < end);
        }

        if (walletId is { } wallet)
        {
            query = query.Where(t => t.FromWalletId == wallet || t.ToWalletId == wallet);
        }

        if (categoryId is { } category)
        {
            var ids = await db.Categories
                .Where(c => c.UserId == userId && (c.Id == category || c.ParentId == category))
                .Select(c => c.Id)
                .ToListAsync(cancellationToken);
            query = query.Where(t => t.CategoryId != null && ids.Contains(t.CategoryId.Value));
        }

        if (type is { } onlyType)
        {
            query = query.Where(t => t.Type == onlyType);
        }

        if (Text.Clean(search) is { } words)
        {
            var pattern = $"%{EscapeLike(words)}%";
            query = query.Where(t => t.Note != null && EF.Functions.ILike(t.Note, pattern, "\\"));
        }

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

    private static string EscapeLike(string text) =>
        text.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
}
