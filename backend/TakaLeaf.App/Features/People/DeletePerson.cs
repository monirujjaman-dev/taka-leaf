using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.People;

/// <summary>DELETE /api/people/{id} - only for someone with no loans recorded, so no history is lost.</summary>
public static class DeletePerson
{
    public static RouteGroupBuilder MapDeletePerson(this RouteGroupBuilder group)
    {
        group.MapDelete("/{id:guid}", Handle).WithName("DeletePerson");
        return group;
    }

    private static async Task<IResult> Handle(Guid id, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var person = await PeopleRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (person is null)
        {
            return NotFound.Problem("Person");
        }

        if (await db.Transactions.AnyAsync(t => t.UserId == userId && t.PersonId == id, cancellationToken))
        {
            return Results.Problem(
                title: $"{person.Name} has loans recorded. Delete those first.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var now = clock.GetUtcNow();
        var wallets = await PeopleRules.WalletsOfAsync(db, userId, id, cancellationToken);
        person.DeletedAt = now;
        wallets.Lent.DeletedAt = now;
        wallets.Borrowed.DeletedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
