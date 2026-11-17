using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Common.Caching;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Budgets;

public enum BudgetStatus
{
    /// <summary>Under 80% spent.</summary>
    OnTrack,

    /// <summary>80% or more spent, but not over.</summary>
    Near,

    /// <summary>More than the budget spent.</summary>
    Over,
}

public sealed record BudgetDto(Guid Id, Guid? CategoryId, string Name, long Amount, long Spent, long Remaining, int Percent, BudgetStatus Status);

public sealed record BudgetList(string Month, IReadOnlyList<BudgetDto> Budgets);

public sealed record CreateBudgetRequest(Guid? CategoryId, long? Amount);

public sealed record UpdateBudgetRequest(long? Amount);

/// <summary>
/// /api/budgets - monthly spending limits, overall or per expense category, with what has been
/// spent against each in a month (local time). A top-level category's budget covers its
/// sub-categories; the overall budget covers every expense, fees included.
/// </summary>
public static class Budgets
{
    public const string OverallName = "All spending";
    public const int NearPercent = 80;

    public static IEndpointRouteBuilder MapBudgets(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/budgets").WithTags("Budgets").RequireAuthorization();
        group.MapGet("/", List).WithName("GetBudgets");
        group.MapPost("/", Create).WithName("CreateBudget");
        group.MapPut("/{id:guid}", Update).WithName("UpdateBudget");
        group.MapDelete("/{id:guid}", Delete).WithName("DeleteBudget");
        return api;
    }

    private static async Task<IResult> List(
        string? month, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, UserDataCache cache, CancellationToken cancellationToken)
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
        var label = first.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        var list = await cache.GetOrCreateAsync(
            userId,
            $"budgets:{label}",
            async ct =>
            {
                var budgets = await db.Budgets.Where(b => b.UserId == userId).ToListAsync(ct);
                var dtos = await ToDtosAsync(db, userId, budgets, calendar.StartOf(first), calendar.StartOf(first.AddMonths(1)), ct);
                return new BudgetList(label, dtos);
            },
            cancellationToken);
        return Results.Ok(list);
    }

    private static async Task<IResult> Create(
        CreateBudgetRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        if (AmountProblem(request.Amount) is { } amountProblem)
        {
            return amountProblem;
        }

        string name = OverallName;
        if (request.CategoryId is { } categoryId)
        {
            var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == categoryId && c.UserId == userId, cancellationToken);
            if (category is null || category.Kind != CategoryKind.Expense)
            {
                return ValidationErrors.For("categoryId", "Choose one of your expense categories.");
            }

            if (category.Archived)
            {
                return ValidationErrors.For("categoryId", "That category is archived.");
            }

            name = category.Name;
        }

        if (await db.Budgets.AnyAsync(b => b.UserId == userId && b.CategoryId == request.CategoryId, cancellationToken))
        {
            return ValidationErrors.For("categoryId", $"{name} already has a budget. Change that one instead.");
        }

        var budget = new Budget { UserId = userId, CategoryId = request.CategoryId, Amount = request.Amount!.Value };
        db.Budgets.Add(budget);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return ValidationErrors.For("categoryId", $"{name} already has a budget. Change that one instead.");
        }

        return Results.Created($"/api/budgets/{budget.Id}", await OneAsync(db, userId, budget, calendar, cancellationToken));
    }

    private static async Task<IResult> Update(
        Guid id, UpdateBudgetRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var budget = await db.Budgets.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId, cancellationToken);
        if (budget is null)
        {
            return NotFound.Problem("Budget");
        }

        if (AmountProblem(request.Amount) is { } amountProblem)
        {
            return amountProblem;
        }

        budget.Amount = request.Amount!.Value;
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(await OneAsync(db, userId, budget, calendar, cancellationToken));
    }

    private static async Task<IResult> Delete(
        Guid id, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var budget = await db.Budgets.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId, cancellationToken);
        if (budget is null)
        {
            return NotFound.Problem("Budget");
        }

        budget.DeletedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static IResult? AmountProblem(long? amount) =>
        amount is not { } value || value <= 0 || value > TransactionRules.MaxAmount
            ? ValidationErrors.For("amount", "Enter a monthly amount above zero.")
            : null;

    private static async Task<BudgetDto> OneAsync(AppDbContext db, Guid userId, Budget budget, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var today = calendar.Today();
        var first = new DateOnly(today.Year, today.Month, 1);
        return (await ToDtosAsync(db, userId, [budget], calendar.StartOf(first), calendar.StartOf(first.AddMonths(1)), cancellationToken))[0];
    }

    private static async Task<IReadOnlyList<BudgetDto>> ToDtosAsync(
        AppDbContext db, Guid userId, IReadOnlyList<Budget> budgets, DateTimeOffset start, DateTimeOffset end, CancellationToken cancellationToken)
    {
        var spentByCategory = await db.Transactions
            .Where(t => t.UserId == userId && t.Type == TransactionType.Expense && t.OccurredAt >= start && t.OccurredAt < end)
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Amount = g.Sum(t => t.Amount) })
            .ToListAsync(cancellationToken);
        var categories = await db.Categories.IgnoreQueryFilters()
            .Where(c => c.UserId == userId)
            .ToDictionaryAsync(c => c.Id, cancellationToken);
        var total = spentByCategory.Sum(s => s.Amount);

        long SpentOn(Guid categoryId) => spentByCategory
            .Where(s => s.CategoryId is { } id && (id == categoryId || (categories.TryGetValue(id, out var c) && c.ParentId == categoryId)))
            .Sum(s => s.Amount);

        return budgets
            .Select(budget =>
            {
                var spent = budget.CategoryId is { } id ? SpentOn(id) : total;
                var name = budget.CategoryId is { } cid && categories.TryGetValue(cid, out var category) ? category.Name : OverallName;
                var percent = (int)Math.Min(spent * 100 / budget.Amount, 999);
                var status = spent > budget.Amount ? BudgetStatus.Over : percent >= NearPercent ? BudgetStatus.Near : BudgetStatus.OnTrack;
                return new BudgetDto(budget.Id, budget.CategoryId, name, budget.Amount, spent, budget.Amount - spent, percent, status);
            })
            .OrderBy(b => b.CategoryId is null ? 0 : 1)
            .ThenBy(b => b.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
