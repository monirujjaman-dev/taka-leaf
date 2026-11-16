namespace TakaLeaf.App.Features.Auth;

public static class AuthEndpoints
{
    public const string RateLimitPolicy = "auth";

    public static IEndpointRouteBuilder MapAuth(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/auth").WithTags("Auth").RequireRateLimiting(RateLimitPolicy);
        group.MapRegister();
        group.MapVerifyEmail();
        group.MapResendVerification();
        group.MapLogin();
        group.MapRefresh();
        group.MapLogout();
        group.MapGetMe();
        group.MapUpdateMe();
        group.MapForgotPassword();
        group.MapResetPassword();
        group.MapChangePassword();
        group.MapSessions();
        return api;
    }
}
