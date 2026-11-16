using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Categories;

/// <summary>A category as the API returns it. Top-level categories carry their sub-categories.</summary>
public sealed record CategoryDto(
    Guid Id,
    CategoryKind Kind,
    string Name,
    Guid? ParentId,
    string? Icon,
    string? Color,
    bool Archived,
    IReadOnlyList<CategoryDto> Children);

internal static class CategoryRules
{
    public const int NameMax = 80;
    public const int IconMax = 40;
    public const int ColorMax = 20;

    public static CategoryDto ToDto(Category category, IReadOnlyList<CategoryDto> children) =>
        new(category.Id, category.Kind, category.Name, category.ParentId, category.Icon, category.Color, category.Archived, children);

    public static Task<Category?> FindOwnedAsync(AppDbContext db, Guid userId, Guid id, CancellationToken cancellationToken) =>
        db.Categories.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, cancellationToken);

    /// <summary>Checks the fields a person types; returns the 400 response, or null when all is well.</summary>
    public static async Task<IResult?> CheckFieldsAsync(
        AppDbContext db,
        Guid userId,
        Guid? categoryId,
        CategoryKind kind,
        Guid? parentId,
        string? name,
        string? icon,
        string? color,
        CancellationToken cancellationToken)
    {
        if (name is null || name.Length > NameMax)
        {
            return ValidationErrors.For("name", $"Give the category a name of up to {NameMax} characters.");
        }

        if (Text.LabelProblem(icon, IconMax) is { } iconProblem)
        {
            return ValidationErrors.For("icon", iconProblem);
        }

        if (Text.LabelProblem(color, ColorMax) is { } colorProblem)
        {
            return ValidationErrors.For("color", colorProblem);
        }

        var lowered = name.ToLowerInvariant();
        var taken = await db.Categories.AnyAsync(
            c => c.UserId == userId && c.Id != categoryId && c.Kind == kind && c.ParentId == parentId && c.Name.ToLower() == lowered,
            cancellationToken);
        return taken ? ValidationErrors.For("name", "A category with this name is already there.") : null;
    }
}
