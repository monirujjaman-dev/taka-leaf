using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace TakaLeaf.App.Features.Auth;

public sealed class AuthOptions
{
    public const string Section = "Auth";
    public const string TokenIssuerName = "takaleaf";
    public const string TokenAudience = "takaleaf";

    /// <summary>Secret for signing access tokens, at least 32 bytes. Production sets it outside Git.</summary>
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 30;

    /// <summary>When false, nobody new can register (set Auth__RegistrationOpen=false once your own account exists).</summary>
    public bool RegistrationOpen { get; set; } = true;

    public SymmetricSecurityKey CreateSigningKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}
