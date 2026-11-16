using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Auth;

/// <summary>PUT /api/auth/me - changes the signed-in person's name, from Settings.</summary>
public static class UpdateMe
{
    public sealed record UpdateMeRequest(string? Name);

    public static RouteGroupBuilder MapUpdateMe(this RouteGroupBuilder group)
    {
        group.MapPut("/me", Handle).WithName("UpdateMe").RequireAuthorization();
        return group;
    }

    private static async Task<IResult> Handle(UpdateMeRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user is null)
        {
            return Results.Unauthorized();
        }

        if (NameRules.Check(request.Name, out var name) is { } problem)
        {
            return ValidationErrors.For("name", problem);
        }

        user.Name = name;
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(AuthUser.From(user));
    }
}
