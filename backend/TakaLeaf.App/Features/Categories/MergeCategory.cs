using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Categories;

/// <summary>
/// POST /api/categories/{id}/merge - moves every transaction of this category into another one
/// of the same kind, then removes this category. Totals do not change; only the label does.
/// Recurring rules move with it; its budget moves too unless the target already has one.
/// </summary>
public static class MergeCategory
{
    public sealed record MergeCategoryRequest(Guid? IntoCategoryId);

    public sealed record MergeCategoryResponse(int MovedTransactions);

    public static RouteGroupBuilder MapMergeCategory(this RouteGroupBuilder group)
    {
        group.MapPost("/{id:guid}/merge", Handle).WithName("MergeCategory");
        return group;
    }

    private static async Task<IResult> Handle(
        Guid id,
        MergeCategoryRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var source = await CategoryRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (source is null)
        {
            return NotFound.Problem("Category");
        }

        if (request.IntoCategoryId is not { } targetId || targetId == source.Id)
        {
            return ValidationErrors.For("intoCategoryId", "Choose another category to merge into.");
        }

        var target = await CategoryRules.FindOwnedAsync(db, userId, targetId, cancellationToken);
        if (target is null)
        {
            return ValidationErrors.For("intoCategoryId", "That category does not exist.");
        }

        if (target.Kind != source.Kind)
        {
            return ValidationErrors.For("intoCategoryId", "Merge into a category of the same kind.");
        }

        var hasChildren = await db.Categories.AnyAsync(c => c.UserId == userId && c.ParentId == source.Id, cancellationToken);
        if (hasChildren)
        {
            return Results.Problem(
                title: "This category has sub-categories. Merge or move them first.",
                statusCode: StatusCodes.Status409Conflict);
        }

        // Loaded and changed one by one, so each row gets a new change number for sync later.
        var transactions = await db.Transactions
            .Where(t => t.UserId == userId && t.CategoryId == source.Id)
            .ToListAsync(cancellationToken);
        foreach (var transaction in transactions)
        {
            transaction.CategoryId = target.Id;
        }

        // Recurring rules follow their category.
        var rules = await db.RecurringRules
            .Where(r => r.UserId == userId && r.CategoryId == source.Id)
            .ToListAsync(cancellationToken);
        foreach (var rule in rules)
        {
            rule.CategoryId = target.Id;
        }

        // A budget moves to the target, unless the target already has its own; then the source's goes.
        var now = clock.GetUtcNow();
        var budget = await db.Budgets.FirstOrDefaultAsync(b => b.UserId == userId && b.CategoryId == source.Id, cancellationToken);
        if (budget is not null)
        {
            if (await db.Budgets.AnyAsync(b => b.UserId == userId && b.CategoryId == target.Id, cancellationToken))
            {
                budget.DeletedAt = now;
            }
            else
            {
                budget.CategoryId = target.Id;
            }
        }

        source.DeletedAt = now;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new MergeCategoryResponse(transactions.Count));
    }
}
