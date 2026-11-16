using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Categories;

/// <summary>
/// DELETE /api/categories/{id} - only for a category that no transaction uses and that has no
/// sub-categories. Otherwise archive it, or merge it into another.
/// </summary>
public static class DeleteCategory
{
    public static RouteGroupBuilder MapDeleteCategory(this RouteGroupBuilder group)
    {
        group.MapDelete("/{id:guid}", Handle).WithName("DeleteCategory");
        return group;
    }

    private static async Task<IResult> Handle(
        Guid id,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var category = await CategoryRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (category is null)
        {
            return NotFound.Problem("Category");
        }

        if (await db.Categories.AnyAsync(c => c.UserId == userId && c.ParentId == id, cancellationToken))
        {
            return Results.Problem(
                title: "This category has sub-categories. Delete or move them first.",
                statusCode: StatusCodes.Status409Conflict);
        }

        if (await db.Transactions.AnyAsync(t => t.UserId == userId && t.CategoryId == id, cancellationToken))
        {
            return Results.Problem(
                title: "Transactions use this category. Archive it, or merge it into another.",
                statusCode: StatusCodes.Status409Conflict);
        }

        category.DeletedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
