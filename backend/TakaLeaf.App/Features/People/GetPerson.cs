using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.People;

/// <summary>GET /api/people/{id} - one person with every loan and repayment, newest first.</summary>
public static class GetPerson
{
    public static RouteGroupBuilder MapGetPerson(this RouteGroupBuilder group)
    {
        group.MapGet("/{id:guid}", Handle).WithName("GetPerson");
        return group;
    }

    private static async Task<IResult> Handle(Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var person = await PeopleRules.FindOwnedAsync(db, userId, id, cancellationToken);
        if (person is null)
        {
            return NotFound.Problem("Person");
        }

        return Results.Ok(await DetailAsync(db, userId, person, cancellationToken));
    }

    internal static async Task<PersonDetail> DetailAsync(AppDbContext db, Guid userId, Data.Entities.Person person, CancellationToken cancellationToken)
    {
        var wallets = await PeopleRules.WalletsOfAsync(db, userId, person.Id, cancellationToken);
        var movements = await Balances.MovementsAsync(db, userId, cancellationToken);
        var loans = await PeopleRules.LoansAsync(db, userId, person.Id, wallets, null, cancellationToken);
        var dto = PeopleRules.ToDto(person, wallets, movements, loans.Count > 0 ? loans.Max(l => l.OccurredAt) : null);
        return new PersonDetail(dto, loans);
    }
}
