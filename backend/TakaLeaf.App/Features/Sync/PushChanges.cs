using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Sync;

/// <summary>
/// POST /api/sync/push - applies the phone's changes in order, in one database transaction. Each
/// change is accepted, superseded (a later change on the server won) or rejected with a reason, and
/// a rejected change does not stop the rest. Sending the same changes twice changes nothing more:
/// the second time each one is older than what the server has, so it comes back superseded.
/// </summary>
public static class PushChanges
{
    private const string Savepoint = "sync_change";

    public static RouteGroupBuilder MapPushChanges(this RouteGroupBuilder group)
    {
        group.MapPost("/push", Handle).WithName("SyncPush");
        return group;
    }

    private static async Task<IResult> Handle(
        PushRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider clock,
        IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions> json,
        CancellationToken cancellationToken)
    {
        if (SyncRules.ProtocolProblem(request.Protocol) is { } problem)
        {
            return problem;
        }

        var changes = request.Changes ?? [];
        if (changes.Count > SyncRules.MaxBatch)
        {
            return ValidationErrors.For("changes", $"Send at most {SyncRules.MaxBatch} changes at a time.");
        }

        var push = new SyncPush(db, principal.UserId(), clock.GetUtcNow(), json.Value.SerializerOptions);
        var results = new List<PushResult>(changes.Count);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        foreach (var change in changes)
        {
            await transaction.CreateSavepointAsync(Savepoint, cancellationToken);
            try
            {
                results.Add(await push.ApplyAsync(change, cancellationToken));
            }
            catch (DbUpdateException)
            {
                // A unique index said no (for example a recurring date the server already recorded).
                await transaction.RollbackToSavepointAsync(Savepoint, cancellationToken);
                db.ChangeTracker.Clear();
                results.Add(await push.ClashAsync(change, cancellationToken));
            }
        }

        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new PushResponse(results));
    }
}
