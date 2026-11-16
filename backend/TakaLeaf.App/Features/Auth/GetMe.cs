using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Auth;

/// <summary>GET /api/auth/me - who is signed in. The web app calls it on start.</summary>
public static class GetMe
{
    public static RouteGroupBuilder MapGetMe(this RouteGroupBuilder group)
    {
        group.MapGet("/me", Handle).WithName("GetMe").RequireAuthorization();
        return group;
    }

    private static async Task<IResult> Handle(ClaimsPrincipal principal, AppDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        return user is null ? Results.Unauthorized() : Results.Ok(new AuthUser(user.Id, user.Email));
    }
}
