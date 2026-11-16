using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Net.Http.Headers;

namespace TakaLeaf.App.Common.Web;

/// <summary>Cache rules for the built web app served from wwwroot.</summary>
public static class WebAppCaching
{
    public static void Apply(StaticFileResponseContext context)
    {
        var path = context.Context.Request.Path;
        context.Context.Response.Headers[HeaderNames.CacheControl] = path.StartsWithSegments("/assets")
            ? "public, max-age=31536000, immutable"
            : "no-cache";
    }
}

/// <summary>
/// Headers that make the browser refuse common attacks: no framing (clickjacking), no MIME
/// sniffing, and a content security policy that allows only this site plus Google Fonts.
/// </summary>
public static class SecurityHeaders
{
    private const string ContentSecurityPolicy =
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self'; " +
        "manifest-src 'self'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'";

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
            headers["Content-Security-Policy"] = ContentSecurityPolicy;
            await next();
        });
}
