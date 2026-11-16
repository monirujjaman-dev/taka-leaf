using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Categories;

/// <summary>
/// POST /api/categories/{id}/archive and /unarchive - an archived category is not offered for new
/// transactions, but old transactions keep it. A top-level category takes its sub-categories along.
/// </summary>
public static class ArchiveCategory
{
    public static RouteGroupBuilder MapArchiveCategory(this RouteGroupBuilder group)
    {
        group.MapPost("/{id:guid}/archive", (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken) =>
            SetArchived(id, true, principal, db, cancellationToken)).WithName("ArchiveCategory");
        group.MapPost("/{id:guid}/unarchive", (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken) =>
            SetArchived(id, false, principal, db, cancellationToken)).WithName("UnarchiveCategory");
        return group;
    }

    private static async Task<IResult> SetArchived(
        Guid id,
        bool archived,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var category = await CategoryRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (category is null)
        {
            return NotFound.Problem("Category");
        }

        if (!archived && category.ParentId is { } parentId)
        {
            var parent = await CategoryRules.FindOwnedAsync(db, userId, parentId, cancellationToken);
            if (parent is { Archived: true })
            {
                return Results.Problem(
                    title: "Its parent category is archived. Unarchive the parent first.",
                    statusCode: StatusCodes.Status409Conflict);
            }
        }

        category.Archived = archived;
        if (category.ParentId is null)
        {
            var children = await db.Categories
                .Where(c => c.UserId == userId && c.ParentId == category.Id && c.Archived != archived)
                .ToListAsync(cancellationToken);
            foreach (var child in children)
            {
                child.Archived = archived;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
