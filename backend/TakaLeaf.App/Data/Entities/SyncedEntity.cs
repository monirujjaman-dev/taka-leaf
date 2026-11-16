namespace TakaLeaf.App.Data.Entities;

/// <summary>
/// Base for every row that belongs to one user and will sync to the Android app in version 2.
/// The columns are in place from the first migration so no table has to be rebuilt later:
/// a client-creatable UUID, timestamps, a soft-delete marker and a server sequence number
/// that increases every time the row changes.
/// </summary>
public abstract class SyncedEntity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public long ServerSeq { get; set; }
}
