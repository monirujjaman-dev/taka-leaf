using System.Security.Claims;

namespace TakaLeaf.App.Common;

/// <summary>Reads who is signed in from the access token's claims.</summary>
public static class CurrentUser
{
    public static Guid UserId(this ClaimsPrincipal principal) => ReadGuid(principal, "sub");

    public static Guid SessionId(this ClaimsPrincipal principal) => ReadGuid(principal, "sid");

    private static Guid ReadGuid(ClaimsPrincipal principal, string claim) =>
        Guid.TryParse(principal.FindFirstValue(claim), out var id)
            ? id
            : throw new InvalidOperationException($"The access token has no valid '{claim}' claim.");
}
