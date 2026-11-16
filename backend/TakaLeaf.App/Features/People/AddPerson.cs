using System.Security.Claims;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.People;

/// <summary>POST /api/people - adds someone to lend to or borrow from, with their two loan wallets.</summary>
public static class AddPerson
{
    public static RouteGroupBuilder MapAddPerson(this RouteGroupBuilder group)
    {
        group.MapPost("/", Handle).WithName("AddPerson");
        return group;
    }

    private static async Task<IResult> Handle(PersonRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var (name, note, problem) = await PeopleRules.CheckAsync(db, userId, null, request, cancellationToken);
        if (problem is not null)
        {
            return problem;
        }

        var person = new Person { UserId = userId, Name = name!, Note = note };
        var lent = new Wallet { UserId = userId, Type = WalletType.Lent, Name = PeopleRules.LentName(name!), PersonId = person.Id };
        var borrowed = new Wallet { UserId = userId, Type = WalletType.Borrowed, Name = PeopleRules.BorrowedName(name!), PersonId = person.Id };
        db.People.Add(person);
        db.Wallets.AddRange(lent, borrowed);
        await db.SaveChangesAsync(cancellationToken);

        var dto = PeopleRules.ToDto(person, new LoanWallets(lent, borrowed), new Dictionary<Guid, long>(), null);
        return Results.Created($"/api/people/{person.Id}", dto);
    }
}
