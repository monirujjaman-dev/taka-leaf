namespace TakaLeaf.App.Data.Entities;

/// <summary>Someone the user lends money to or borrows money from.</summary>
public sealed class Person : SyncedEntity
{
    public string Name { get; set; } = "";
    public string? Note { get; set; }
}
