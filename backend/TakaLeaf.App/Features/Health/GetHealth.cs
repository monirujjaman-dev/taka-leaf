using Microsoft.Extensions.Caching.Distributed;
using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Health;

/// <summary>
/// GET /api/health - tells a monitor (and the web app's first screen) that the API is running
/// and whether it can reach PostgreSQL and, when one is set up, Redis ("memory" when the cache
/// lives only in this process). The whole slice lives in this file.
/// </summary>
public static class GetHealth
{
    public sealed record Response(string Status, string Database, string Cache);

    public static IEndpointRouteBuilder MapGetHealth(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/health", Handle).WithName("GetHealth").WithTags("Health");
        return routes;
    }

    private static async Task<IResult> Handle(AppDbContext db, IConfiguration configuration, IServiceProvider services, CancellationToken cancellationToken)
    {
        bool databaseUp;
        try
        {
            databaseUp = await db.Database.CanConnectAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            databaseUp = false;
        }

        var cache = "memory";
        if (!string.IsNullOrWhiteSpace(configuration.GetConnectionString("Redis")))
        {
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(2));
                await services.GetRequiredService<IDistributedCache>().GetAsync("health", timeout.Token);
                cache = "up";
            }
            catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
            {
                cache = "down";
            }
        }

        return Results.Ok(new Response("ok", databaseUp ? "up" : "down", cache));
    }
}
