using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Categories;

/// <summary>PUT /api/categories/{id} - renames a category or changes its icon, colour or order.</summary>
public static class UpdateCategory
{
    public sealed record UpdateCategoryRequest(string? Name, string? Icon, string? Color, int? SortOrder);

    public static RouteGroupBuilder MapUpdateCategory(this RouteGroupBuilder group)
    {
        group.MapPut("/{id:guid}", Handle).WithName("UpdateCategory");
        return group;
    }

    private static async Task<IResult> Handle(
        Guid id,
        UpdateCategoryRequest request,
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

        var name = Text.Clean(request.Name);
        var icon = Text.Clean(request.Icon);
        var color = Text.Clean(request.Color);
        if (await CategoryRules.CheckFieldsAsync(db, userId, category.Id, category.Kind, category.ParentId, name, icon, color, cancellationToken) is { } problem)
        {
            return problem;
        }

        category.Name = name!;
        category.Icon = icon;
        category.Color = color;
        category.SortOrder = request.SortOrder ?? category.SortOrder;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(CategoryRules.ToDto(category, []));
    }
}
