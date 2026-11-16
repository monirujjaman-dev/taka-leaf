namespace TakaLeaf.App.Features.Categories;

public static class CategoryEndpoints
{
    public static IEndpointRouteBuilder MapCategories(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/categories").WithTags("Categories").RequireAuthorization();
        group.MapGetCategories();
        group.MapCreateCategory();
        group.MapUpdateCategory();
        group.MapArchiveCategory();
        group.MapMergeCategory();
        group.MapDeleteCategory();
        return api;
    }
}
