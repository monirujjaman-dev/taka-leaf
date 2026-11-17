using System.Text.Json;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Common.Outbox;

/// <summary>
/// Adds messages to the outbox in the request's own unit of work: they are saved by the same
/// SaveChangesAsync as the change that caused them, or not at all.
/// </summary>
public sealed class OutboxWriter(AppDbContext db, OutboxSignal signal, TimeProvider clock)
{
    private bool listening;

    public void Add<T>(string type, T payload)
    {
        var now = clock.GetUtcNow();
        db.OutboxMessages.Add(new OutboxMessage
        {
            Type = type,
            Payload = JsonSerializer.Serialize(payload, JsonSerializerOptions.Web),
            CreatedAt = now,
            AvailableAt = now,
        });

        if (!listening)
        {
            listening = true;
            db.SavedChanges += (_, _) => signal.Notify();
        }
    }
}
