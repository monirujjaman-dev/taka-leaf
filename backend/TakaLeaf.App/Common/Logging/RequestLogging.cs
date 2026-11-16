using System.Security.Claims;
using Serilog;
using Serilog.AspNetCore;
using Serilog.Context;

namespace TakaLeaf.App.Common.Logging;

/// <summary>
/// Structured logging with Serilog. Sinks (console, file, Seq) come from the "Serilog" section of
/// configuration. Every request gets one summary line with the caller's IP address and user, and
/// every other log line written during the request carries the same two properties.
/// </summary>
public static class RequestLogging
{
    public const string Anonymous = "anonymous";

    public static IServiceCollection AddTakaLeafLogging(this IServiceCollection services) =>
        services.AddSerilog(
            (provider, logger) => logger
                .ReadFrom.Configuration(provider.GetRequiredService<IConfiguration>())
                .ReadFrom.Services(provider)
                .Enrich.FromLogContext(),
            // Each app keeps its own logger; the test host starts several apps in one process.
            preserveStaticLogger: true);

    /// <summary>Call before authentication so the summary line times the whole request.</summary>
    public static IApplicationBuilder UseTakaLeafRequestLogging(this IApplicationBuilder app) =>
        app.UseSerilogRequestLogging(options =>
        {
            options.Logger = app.ApplicationServices.GetService<Serilog.ILogger>();
            options.MessageTemplate =
                "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0} ms for {UserName} from {ClientIp}";
            options.EnrichDiagnosticContext = Enrich;
        });

    /// <summary>Call after authentication, so the signed-in user is known.</summary>
    public static IApplicationBuilder UseRequestLogContext(this IApplicationBuilder app) =>
        app.Use(async (http, next) =>
        {
            using (LogContext.PushProperty("ClientIp", ClientIp(http)))
            using (LogContext.PushProperty("UserName", UserName(http.User)))
            using (LogContext.PushProperty("UserId", http.User.FindFirstValue("sub")))
            {
                await next(http);
            }
        });

    private static void Enrich(IDiagnosticContext diagnostics, HttpContext http)
    {
        diagnostics.Set("ClientIp", ClientIp(http));
        diagnostics.Set("UserName", UserName(http.User));
        diagnostics.Set("UserId", http.User.FindFirstValue("sub"));
        diagnostics.Set("UserAgent", http.Request.Headers.UserAgent.ToString());
    }

    /// <summary>The caller's address. Behind a trusted reverse proxy, forwarded headers set it first.</summary>
    public static string ClientIp(HttpContext http) => http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    /// <summary>TakaLeaf has no user names; the signed-in user's email is the name.</summary>
    public static string UserName(ClaimsPrincipal user) => user.FindFirstValue("email") ?? Anonymous;
}
