using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Categories;

/// <summary>
/// GET /api/categories?kind=Expense - top-level categories in order, each with its sub-categories.
/// Archived ones are left out unless includeArchived=true.
/// </summary>
public static class GetCategories
{
    public static RouteGroupBuilder MapGetCategories(this RouteGroupBuilder group)
    {
        group.MapGet("/", Handle).WithName("GetCategories");
        return group;
    }

    private static async Task<IResult> Handle(
        CategoryKind? kind,
        bool? includeArchived,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();

        // Accounts made before starter categories existed get them on first look.
        await StarterCategories.EnsureAsync(db, userId, cancellationToken);

        var query = db.Categories.Where(c => c.UserId == userId);
        if (kind is { } onlyKind)
        {
            query = query.Where(c => c.Kind == onlyKind);
        }

        if (includeArchived != true)
        {
            query = query.Where(c => !c.Archived);
        }

        var rows = await query.OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(cancellationToken);
        var children = rows.Where(c => c.ParentId != null).ToLookup(c => c.ParentId!.Value);
        var tree = rows
            .Where(c => c.ParentId == null)
            .Select(parent => CategoryRules.ToDto(
                parent,
                children[parent.Id].Select(child => CategoryRules.ToDto(child, [])).ToList()))
            .ToList();

        return Results.Ok(tree);
    }
}
