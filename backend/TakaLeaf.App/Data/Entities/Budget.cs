namespace TakaLeaf.App.Data.Entities;

/// <summary>A monthly spending limit, the same every month. No category means all spending.</summary>
public sealed class Budget : SyncedEntity
{
    /// <summary>An expense category; a top-level one covers its sub-categories. Null for the overall budget.</summary>
    public Guid? CategoryId { get; set; }

    /// <summary>In poisha, per month.</summary>
    public long Amount { get; set; }
}
