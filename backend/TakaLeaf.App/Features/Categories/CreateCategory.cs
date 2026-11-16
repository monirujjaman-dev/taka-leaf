using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Categories;

/// <summary>
/// POST /api/categories - adds a category, or a sub-category when ParentId is given.
/// Two levels only: a sub-category cannot have sub-categories.
/// </summary>
public static class CreateCategory
{
    /// <param name="Kind">Income or Expense. A sub-category takes its parent's kind.</param>
    public sealed record CreateCategoryRequest(CategoryKind? Kind, string? Name, Guid? ParentId, string? Icon, string? Color);

    public static RouteGroupBuilder MapCreateCategory(this RouteGroupBuilder group)
    {
        group.MapPost("/", Handle).WithName("CreateCategory");
        return group;
    }

    private static async Task<IResult> Handle(
        CreateCategoryRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        CategoryKind kind;

        if (request.ParentId is { } parentId)
        {
            var parent = await CategoryRules.FindOwnedAsync(db, userId, parentId, cancellationToken);
            if (parent is null)
            {
                return ValidationErrors.For("parentId", "That parent category does not exist.");
            }

            if (parent.ParentId is not null)
            {
                return ValidationErrors.For("parentId", "A sub-category cannot have sub-categories.");
            }

            if (request.Kind is { } asked && asked != parent.Kind)
            {
                return ValidationErrors.For("kind", "A sub-category has the same kind as its parent.");
            }

            kind = parent.Kind;
        }
        else if (request.Kind is { } chosen)
        {
            kind = chosen;
        }
        else
        {
            return ValidationErrors.For("kind", "Choose Income or Expense.");
        }

        var name = Text.Clean(request.Name);
        var icon = Text.Clean(request.Icon);
        var color = Text.Clean(request.Color);
        if (await CategoryRules.CheckFieldsAsync(db, userId, null, kind, request.ParentId, name, icon, color, cancellationToken) is { } problem)
        {
            return problem;
        }

        var lastOrder = await db.Categories
            .Where(c => c.UserId == userId && c.Kind == kind && c.ParentId == request.ParentId)
            .MaxAsync(c => (int?)c.SortOrder, cancellationToken);
        var category = new Category
        {
            UserId = userId,
            Kind = kind,
            Name = name!,
            ParentId = request.ParentId,
            Icon = icon,
            Color = color,
            SortOrder = (lastOrder ?? -1) + 1,
        };
        db.Categories.Add(category);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/categories/{category.Id}", CategoryRules.ToDto(category, []));
    }
}
