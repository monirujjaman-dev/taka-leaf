using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.People;

/// <summary>PUT /api/people/{id} - renames a person (and their loan wallets) or changes the note.</summary>
public static class UpdatePerson
{
    public static RouteGroupBuilder MapUpdatePerson(this RouteGroupBuilder group)
    {
        group.MapPut("/{id:guid}", Handle).WithName("UpdatePerson");
        return group;
    }

    private static async Task<IResult> Handle(Guid id, PersonRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var person = await PeopleRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (person is null)
        {
            return NotFound.Problem("Person");
        }

        var (name, note, problem) = await PeopleRules.CheckAsync(db, userId, id, request, cancellationToken);
        if (problem is not null)
        {
            return problem;
        }

        var wallets = await PeopleRules.WalletsOfAsync(db, userId, id, cancellationToken);
        person.Name = name!;
        person.Note = note;
        wallets.Lent.Name = PeopleRules.LentName(name!);
        wallets.Borrowed.Name = PeopleRules.BorrowedName(name!);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok((await GetPerson.DetailAsync(db, userId, person, cancellationToken)).Person);
    }
}
