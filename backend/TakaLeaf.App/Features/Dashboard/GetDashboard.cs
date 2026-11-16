using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Dashboard;

/// <summary>
/// GET /api/dashboard?month=2026-11 - what the first screen shows: net balance, assets and
/// liabilities now; income, expense and spending by category for the month; loan totals; and the
/// five newest transactions. The month is counted in local time and defaults to this one.
/// </summary>
public static class GetDashboard
{
    public const int RecentCount = 5;
    public const string Uncategorised = "Uncategorised";

    public sealed record CategorySpending(Guid? CategoryId, string Name, long Amount);

    public sealed record DashboardDto(
        string Month,
        long NetBalance,
        long Assets,
        long Liabilities,
        long Income,
        long Expense,
        long OwedToMe,
        long IOwe,
        IReadOnlyList<CategorySpending> SpendingByCategory,
        IReadOnlyList<TransactionDto> Recent);

    public static IEndpointRouteBuilder MapDashboard(this IEndpointRouteBuilder api)
    {
        api.MapGet("/dashboard", Handle).WithName("GetDashboard").WithTags("Dashboard").RequireAuthorization();
        return api;
    }

    private static async Task<IResult> Handle(
        string? month,
        ClaimsPrincipal principal,
        AppDbContext db,
        LocalCalendar calendar,
        CancellationToken cancellationToken)
    {
        DateOnly first;
        if (month is null)
        {
            var today = calendar.Today();
            first = new DateOnly(today.Year, today.Month, 1);
        }
        else if (!DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out first))
        {
            return ValidationErrors.For("month", "Give the month as year and month, for example 2026-11.");
        }

        var userId = principal.UserId();
        var start = calendar.StartOf(first);
        var end = calendar.StartOf(first.AddMonths(1));

        var wallets = await db.Wallets.Where(w => w.UserId == userId).ToListAsync(cancellationToken);
        var summary = Balances.Summarize(wallets, await Balances.MovementsAsync(db, userId, cancellationToken));

        var inMonth = db.Transactions.Where(t => t.UserId == userId && t.OccurredAt >= start && t.OccurredAt < end);
        var income = await inMonth.Where(t => t.Type == TransactionType.Income).SumAsync(t => (long?)t.Amount, cancellationToken) ?? 0;
        var expenseRows = await inMonth
            .Where(t => t.Type == TransactionType.Expense)
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Amount = g.Sum(t => t.Amount) })
            .ToListAsync(cancellationToken);

        var categories = await db.Categories.IgnoreQueryFilters()
            .Where(c => c.UserId == userId)
            .ToDictionaryAsync(c => c.Id, cancellationToken);
        var spending = expenseRows
            .GroupBy(row => TopLevel(row.CategoryId, categories))
            .Select(g => new CategorySpending(g.Key?.Id, g.Key?.Name ?? Uncategorised, g.Sum(row => row.Amount)))
            .OrderByDescending(s => s.Amount)
            .ToList();

        var recentRows = await db.Transactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.OccurredAt)
            .ThenByDescending(t => t.CreatedAt)
            .Take(RecentCount)
            .ToListAsync(cancellationToken);
        var recent = await TransactionRules.ToDtosAsync(db, userId, recentRows, cancellationToken);

        return Results.Ok(new DashboardDto(
            first.ToString("yyyy-MM", CultureInfo.InvariantCulture),
            summary.Net,
            summary.Assets,
            summary.Liabilities,
            income,
            expenseRows.Sum(row => row.Amount),
            summary.OwedToMe,
            summary.IOwe,
            spending,
            recent));
    }

    /// <summary>Spending is shown per top-level category: a sub-category counts toward its parent.</summary>
    private static Category? TopLevel(Guid? categoryId, Dictionary<Guid, Category> categories)
    {
        if (categoryId is not { } id || !categories.TryGetValue(id, out var category))
        {
            return null;
        }

        return category.ParentId is { } parentId && categories.TryGetValue(parentId, out var parent) ? parent : category;
    }
}
