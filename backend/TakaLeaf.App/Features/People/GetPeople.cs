using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.People;

/// <summary>GET /api/people - everyone, with what they owe and are owed. People with money outstanding come first.</summary>
public static class GetPeople
{
    public static RouteGroupBuilder MapGetPeople(this RouteGroupBuilder group)
    {
        group.MapGet("/", Handle).WithName("GetPeople");
        return group;
    }

    private static async Task<IResult> Handle(ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var people = await db.People.Where(p => p.UserId == userId).ToListAsync(cancellationToken);
        var wallets = await db.Wallets.Where(w => w.UserId == userId && w.PersonId != null).ToListAsync(cancellationToken);
        var movements = await Balances.MovementsAsync(db, userId, cancellationToken);
        var lastLoans = await db.Transactions
            .Where(t => t.UserId == userId && t.PersonId != null)
            .GroupBy(t => t.PersonId)
            .Select(g => new { PersonId = g.Key!.Value, Last = g.Max(t => t.OccurredAt) })
            .ToDictionaryAsync(x => x.PersonId, x => x.Last, cancellationToken);

        var byPerson = wallets.ToLookup(w => w.PersonId!.Value);
        var list = people
            .Select(person =>
            {
                var own = byPerson[person.Id].ToList();
                var pair = new LoanWallets(own.Single(w => w.Type == WalletType.Lent), own.Single(w => w.Type == WalletType.Borrowed));
                return PeopleRules.ToDto(person, pair, movements, lastLoans.TryGetValue(person.Id, out var last) ? last : null);
            })
            .OrderByDescending(p => p.OwesMe + p.IOwe > 0)
            .ThenBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Results.Ok(new PeopleList(list, list.Sum(p => p.OwesMe), list.Sum(p => p.IOwe)));
    }
}
