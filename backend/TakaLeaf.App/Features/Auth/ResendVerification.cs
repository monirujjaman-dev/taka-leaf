using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// POST /api/auth/resend-verification - the "Resend email" button. Always answers the same way.
/// </summary>
public static class ResendVerification
{
    public sealed record ResendVerificationRequest(string? Email);

    public static RouteGroupBuilder MapResendVerification(this RouteGroupBuilder group)
    {
        group.MapPost("/resend-verification", Handle).WithName("ResendVerification").AllowAnonymous();
        return group;
    }

    private static async Task<IResult> Handle(
        ResendVerificationRequest request,
        AppDbContext db,
        VerificationEmails emails,
        CancellationToken cancellationToken)
    {
        if (EmailRules.TryNormalize(request.Email, out var email))
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
            if (user is { EmailVerifiedAt: null })
            {
                await emails.SendVerificationAsync(user, user.PasswordHash, user.Name, cancellationToken);
            }
        }

        return Results.Accepted(value: new MessageResponse(Register.Message));
    }
}
