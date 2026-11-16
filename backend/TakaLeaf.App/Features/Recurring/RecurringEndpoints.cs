using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Recurring;

/// <summary>
/// /api/recurring - repeating transactions. GET / lists them and GET /due those waiting to be
/// recorded; POST /{id}/record and /{id}/skip deal with the next due date.
/// </summary>
public static class RecurringEndpoints
{
    public static IEndpointRouteBuilder MapRecurring(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/recurring").WithTags("Recurring").RequireAuthorization();
        group.MapGet("/", List).WithName("GetRecurring");
        group.MapGet("/due", Due).WithName("GetRecurringDue");
        group.MapGet("/{id:guid}", Get).WithName("GetRecurringRule");
        group.MapPost("/", Create).WithName("CreateRecurring");
        group.MapPut("/{id:guid}", Update).WithName("UpdateRecurring");
        group.MapDelete("/{id:guid}", Delete).WithName("DeleteRecurring");
        group.MapPost("/{id:guid}/pause", Pause).WithName("PauseRecurring");
        group.MapPost("/{id:guid}/resume", Resume).WithName("ResumeRecurring");
        group.MapPost("/{id:guid}/record", Record).WithName("RecordRecurring");
        group.MapPost("/{id:guid}/skip", Skip).WithName("SkipRecurring");
        return api;
    }

    private static Task<RecurringRule?> FindAsync(AppDbContext db, Guid userId, Guid id, CancellationToken ct) =>
        db.RecurringRules.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId, ct);

    private static async Task<RecurringDto> DtoAsync(AppDbContext db, Guid userId, RecurringRule rule, LocalCalendar calendar, CancellationToken ct) =>
        (await RecurringRules.ToDtosAsync(db, userId, [rule], calendar.Today(), ct))[0];

    private static async Task<IResult> List(ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken ct)
    {
        var userId = principal.UserId();
        var rules = await db.RecurringRules.Where(r => r.UserId == userId).OrderBy(r => r.NextDate).ToListAsync(ct);
        return Results.Ok(await RecurringRules.ToDtosAsync(db, userId, rules, calendar.Today(), ct));
    }

    private static async Task<IResult> Due(ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken ct)
    {
        var userId = principal.UserId();
        var today = calendar.Today();
        var rules = await db.RecurringRules
            .Where(r => r.UserId == userId && !r.Paused && r.NextDate <= today && (r.EndDate == null || r.NextDate <= r.EndDate))
            .OrderBy(r => r.NextDate)
            .ToListAsync(ct);
        return Results.Ok(await RecurringRules.ToDtosAsync(db, userId, rules, today, ct));
    }

    private static async Task<IResult> Get(Guid id, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken ct)
    {
        var userId = principal.UserId();
        var rule = await FindAsync(db, userId, id, ct);
        return rule is null ? NotFound.Problem("Recurring transaction") : Results.Ok(await DtoAsync(db, userId, rule, calendar, ct));
    }

    private static async Task<IResult> Create(
        RecurringRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken ct)
    {
        var userId = principal.UserId();
        if (await RecurringRules.CheckAsync(db, userId, request, null, clock.GetUtcNow(), ct) is { } problem)
        {
            return problem;
        }

        var rule = new RecurringRule { UserId = userId };
        RecurringRules.Apply(rule, request, isNew: true);
        db.RecurringRules.Add(rule);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/recurring/{rule.Id}", await DtoAsync(db, userId, rule, calendar, ct));
    }

    private static async Task<IResult> Update(
        Guid id, RecurringRequest request, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, TimeProvider clock, CancellationToken ct)
    {
        var userId = principal.UserId();
        var rule = await FindAsync(db, userId, id, ct);
        if (rule is null)
        {
            return NotFound.Problem("Recurring transaction");
        }

        if (await RecurringRules.CheckAsync(db, userId, request, rule, clock.GetUtcNow(), ct) is { } problem)
        {
            return problem;
        }

        RecurringRules.Apply(rule, request, isNew: false);
        await db.SaveChangesAsync(ct);
        return Results.Ok(await DtoAsync(db, userId, rule, calendar, ct));
    }

    /// <summary>Stops the rule. Transactions it already recorded stay.</summary>
    private static async Task<IResult> Delete(Guid id, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var rule = await FindAsync(db, principal.UserId(), id, ct);
        if (rule is null)
        {
            return NotFound.Problem("Recurring transaction");
        }

        rule.DeletedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static Task<IResult> Pause(Guid id, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken ct) =>
        SetPaused(id, true, principal, db, calendar, ct);

    private static Task<IResult> Resume(Guid id, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken ct) =>
        SetPaused(id, false, principal, db, calendar, ct);

    private static async Task<IResult> SetPaused(Guid id, bool paused, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken ct)
    {
        var userId = principal.UserId();
        var rule = await FindAsync(db, userId, id, ct);
        if (rule is null)
        {
            return NotFound.Problem("Recurring transaction");
        }

        rule.Paused = paused;
        await db.SaveChangesAsync(ct);
        return Results.Ok(await DtoAsync(db, userId, rule, calendar, ct));
    }

    private static async Task<IResult> Record(
        Guid id, RecordRequest? request, ClaimsPrincipal principal, AppDbContext db, RecurringRecorder recorder, CancellationToken ct)
    {
        var userId = principal.UserId();
        var rule = await FindAsync(db, userId, id, ct);
        if (rule is null)
        {
            return NotFound.Problem("Recurring transaction");
        }

        if (RecurringRules.Ended(rule))
        {
            return Results.Problem(title: "This recurring transaction has ended.", statusCode: StatusCodes.Status409Conflict);
        }

        try
        {
            var (transaction, problem) = await recorder.RecordNextAsync(rule, request?.Amount, request?.OccurredAt, ct);
            if (problem is not null)
            {
                return problem;
            }

            var dto = (await TransactionRules.ToDtosAsync(db, userId, [transaction!], ct))[0];
            return Results.Created($"/api/transactions/{transaction!.Id}", dto);
        }
        catch (DbUpdateException)
        {
            return Results.Problem(title: "That date was just recorded. Refresh to see it.", statusCode: StatusCodes.Status409Conflict);
        }
    }

    private static async Task<IResult> Skip(Guid id, ClaimsPrincipal principal, AppDbContext db, LocalCalendar calendar, CancellationToken ct)
    {
        var userId = principal.UserId();
        var rule = await FindAsync(db, userId, id, ct);
        if (rule is null)
        {
            return NotFound.Problem("Recurring transaction");
        }

        if (RecurringRules.Ended(rule))
        {
            return Results.Problem(title: "This recurring transaction has ended.", statusCode: StatusCodes.Status409Conflict);
        }

        RecurringRules.Advance(rule);
        await db.SaveChangesAsync(ct);
        return Results.Ok(await DtoAsync(db, userId, rule, calendar, ct));
    }
}
