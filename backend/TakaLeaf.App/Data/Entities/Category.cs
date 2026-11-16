namespace TakaLeaf.App.Data.Entities;

public enum CategoryKind
{
    Income,
    Expense,
}

/// <summary>Two levels: a category, and sub-categories that point to it through ParentId.</summary>
public sealed class Category : SyncedEntity
{
    public CategoryKind Kind { get; set; }
    public string Name { get; set; } = "";
    public Guid? ParentId { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public bool Archived { get; set; }
    public int SortOrder { get; set; }
}
