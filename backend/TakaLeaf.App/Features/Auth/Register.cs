using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Auth;

/// <summary>
/// POST /api/auth/register - creates an account and emails a verification link.
/// The answer is the same whether or not the email already has an account, so this
/// endpoint cannot be used to find out who uses TakaLeaf.
/// </summary>
public static class Register
{
    public const string Message = "Check your email for a link to finish creating your account.";

    public sealed record RegisterRequest(string? Email, string? Password);

    public static RouteGroupBuilder MapRegister(this RouteGroupBuilder group)
    {
        group.MapPost("/register", Handle).WithName("Register").AllowAnonymous();
        return group;
    }

    private static async Task<IResult> Handle(
        RegisterRequest request,
        AppDbContext db,
        IPasswordHasher<User> hasher,
        VerificationEmails emails,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        if (!EmailRules.TryNormalize(request.Email, out var email))
        {
            return ValidationErrors.For("email", "Enter a valid email address.");
        }

        if (PasswordRules.Check(request.Password, email) is { } passwordProblem)
        {
            return ValidationErrors.For("password", passwordProblem);
        }

        var password = request.Password!;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (user is null)
        {
            user = new User { Email = email, CreatedAt = clock.GetUtcNow() };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Users.Add(user);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // The same email was registered by another request at the same moment.
                return Accepted();
            }

            await StarterCategories.EnsureAsync(db, user.Id, cancellationToken);
            await emails.SendVerificationAsync(user, user.PasswordHash, cancellationToken);
        }
        else if (user.EmailVerifiedAt is null)
        {
            // Not verified yet: send a new link. The password chosen now is applied only
            // if this particular link is the one that gets opened.
            var passwordHash = hasher.HashPassword(user, password);
            user.PasswordHash = passwordHash;
            await emails.SendVerificationAsync(user, passwordHash, cancellationToken);
        }
        else
        {
            await emails.SendAlreadyRegisteredAsync(user, cancellationToken);
        }

        return Accepted();
    }

    private static IResult Accepted() => Results.Accepted(value: new MessageResponse(Message));
}
