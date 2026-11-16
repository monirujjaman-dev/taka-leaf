using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// POST /api/auth/forgot-password - emails a reset link. The answer is the same for every
/// email, so this endpoint cannot be used to find out who has an account.
/// </summary>
public static class ForgotPassword
{
    public const string Message = "If an account exists for this email, a link to reset the password is on its way.";

    public sealed record ForgotPasswordRequest(string? Email);

    public static RouteGroupBuilder MapForgotPassword(this RouteGroupBuilder group)
    {
        group.MapPost("/forgot-password", Handle).WithName("ForgotPassword").AllowAnonymous();
        return group;
    }

    private static async Task<IResult> Handle(
        ForgotPasswordRequest request,
        AppDbContext db,
        PasswordEmails emails,
        CancellationToken cancellationToken)
    {
        if (EmailRules.TryNormalize(request.Email, out var email))
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
            if (user is not null)
            {
                await emails.SendResetLinkAsync(user, cancellationToken);
            }
        }

        return Results.Accepted(value: new MessageResponse(Message));
    }
}
