using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Caching;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Reports;

public enum ReportPeriod
{
    Month,
    Year,
}

/// <summary>
/// GET /api/reports?period=Month&amp;month=2026-11 or ?period=Year&amp;year=2026 - income against
/// expense, what was saved, totals by category (top-level, with sub-categories for drill-down), and
/// a trend: the six months up to the chosen month, or the twelve months of the chosen year.
/// Only income and expense count: transfers and loans move money between the user's own places.
/// Days and months are local (LocalCalendar).
/// </summary>
public static class GetReport
{
    public const string Uncategorised = "Uncategorised";
    public const int TrendMonthsForMonth = 6;

    public sealed record SubCategoryTotal(Guid? CategoryId, string Name, long Amount);

    /// <param name="Percent">Share of the kind's total, rounded down, 0–100.</param>
    public sealed record CategoryTotal(Guid? CategoryId, string Name, long Amount, int Percent, IReadOnlyList<SubCategoryTotal> Children);

    public sealed record TrendPoint(string Month, long Income, long Expense);

    /// <param name="From">First local day of the period.</param>
    /// <param name="To">Last local day of the period.</param>
    /// <param name="SavedPercent">Saved as a share of income, rounded down; null when there was no income.</param>
    public sealed record ReportDto(
        ReportPeriod Period,
        string Label,
        DateOnly From,
        DateOnly To,
        long Income,
        long Expense,
        long Saved,
        int? SavedPercent,
        IReadOnlyList<CategoryTotal> Spending,
        IReadOnlyList<CategoryTotal> Earning,
        IReadOnlyList<TrendPoint> Trend);

    private sealed record Row(TransactionType Type, long Amount, Guid? CategoryId, DateTimeOffset OccurredAt);

    public static IEndpointRouteBuilder MapReports(this IEndpointRouteBuilder api)
    {
        api.MapGet("/reports", Handle).WithName("GetReport").WithTags("Reports").RequireAuthorization();
        return api;
    }

    private static async Task<IResult> Handle(
        ReportPeriod? period,
        string? month,
        int? year,
        ClaimsPrincipal principal,
        AppDbContext db,
        LocalCalendar calendar,
        UserDataCache cache,
        CancellationToken cancellationToken)
    {
        var today = calendar.Today();
        var kind = period ?? ReportPeriod.Month;
        DateOnly from, to, trendFrom;
        string label;

        if (kind == ReportPeriod.Year)
        {
            var chosen = year ?? today.Year;
            if (chosen is < 2000 or > 2100)
            {
                return ValidationErrors.For("year", "Give a year like 2026.");
            }

            from = new DateOnly(chosen, 1, 1);
            to = new DateOnly(chosen, 12, 31);
            trendFrom = from;
            label = chosen.ToString(CultureInfo.InvariantCulture);
        }
        else
        {
            DateOnly first;
            if (month is null)
            {
                first = new DateOnly(today.Year, today.Month, 1);
            }
            else if (!DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out first))
            {
                return ValidationErrors.For("month", "Give the month as year and month, for example 2026-11.");
            }

            from = first;
            to = first.AddMonths(1).AddDays(-1);
            trendFrom = first.AddMonths(1 - TrendMonthsForMonth);
            label = first.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        }

        var userId = principal.UserId();
        var report = await cache.GetOrCreateAsync(
            userId,
            $"report:{kind}:{label}",
            ct => LoadAsync(db, calendar, userId, kind, label, from, to, trendFrom, ct),
            cancellationToken);
        return Results.Ok(report);
    }

    private static async ValueTask<ReportDto> LoadAsync(
        AppDbContext db,
        LocalCalendar calendar,
        Guid userId,
        ReportPeriod kind,
        string label,
        DateOnly from,
        DateOnly to,
        DateOnly trendFrom,
        CancellationToken cancellationToken)
    {
        var start = calendar.StartOf(trendFrom);
        var end = calendar.StartOf(to.AddDays(1));
        var rows = await db.Transactions
            .Where(t => t.UserId == userId
                && (t.Type == TransactionType.Income || t.Type == TransactionType.Expense)
                && t.OccurredAt >= start && t.OccurredAt < end)
            .Select(t => new Row(t.Type, t.Amount, t.CategoryId, t.OccurredAt))
            .ToListAsync(cancellationToken);

        var periodStart = calendar.StartOf(from);
        var inPeriod = rows.Where(r => r.OccurredAt >= periodStart).ToList();
        var income = inPeriod.Where(r => r.Type == TransactionType.Income).Sum(r => r.Amount);
        var expense = inPeriod.Where(r => r.Type == TransactionType.Expense).Sum(r => r.Amount);
        var saved = income - expense;

        var categories = await db.Categories.IgnoreQueryFilters()
            .Where(c => c.UserId == userId)
            .ToDictionaryAsync(c => c.Id, cancellationToken);

        // Each row's local month is worked out once, then summed per month.
        var byMonth = rows
            .GroupBy(r => { var d = calendar.DateOf(r.OccurredAt); return (d.Year, d.Month); })
            .ToDictionary(
                g => g.Key,
                g => (Income: g.Where(r => r.Type == TransactionType.Income).Sum(r => r.Amount), Expense: g.Where(r => r.Type == TransactionType.Expense).Sum(r => r.Amount)));
        var trend = new List<TrendPoint>();
        for (var m = trendFrom; m <= to; m = m.AddMonths(1))
        {
            var totals = byMonth.GetValueOrDefault((m.Year, m.Month));
            trend.Add(new TrendPoint(m.ToString("yyyy-MM", CultureInfo.InvariantCulture), totals.Income, totals.Expense));
        }

        return new ReportDto(
            kind,
            label,
            from,
            to,
            income,
            expense,
            saved,
            income > 0 ? (int)(saved * 100 / income) : null,
            ByCategory(inPeriod.Where(r => r.Type == TransactionType.Expense), expense, categories),
            ByCategory(inPeriod.Where(r => r.Type == TransactionType.Income), income, categories),
            trend);
    }

    /// <summary>Totals per top-level category (a sub-category counts toward its parent), largest first.</summary>
    private static List<CategoryTotal> ByCategory(IEnumerable<Row> rows, long total, Dictionary<Guid, Category> categories)
    {
        Category? Find(Guid? id) => id is { } key && categories.TryGetValue(key, out var c) ? c : null;
        Category? TopOf(Category? c) => c?.ParentId is { } parent && categories.TryGetValue(parent, out var p) ? p : c;

        return rows
            .GroupBy(r => TopOf(Find(r.CategoryId))?.Id)
            .Select(group =>
            {
                var top = Find(group.Key);
                var amount = group.Sum(r => r.Amount);
                var children = group
                    .GroupBy(r => r.CategoryId)
                    .Select(g => new SubCategoryTotal(g.Key, Find(g.Key)?.Name ?? Uncategorised, g.Sum(r => r.Amount)))
                    .OrderByDescending(c => c.Amount)
                    .ToList();
                return new CategoryTotal(group.Key, top?.Name ?? Uncategorised, amount, total > 0 ? (int)(amount * 100 / total) : 0, children);
            })
            .OrderByDescending(c => c.Amount)
            .ToList();
    }
}
