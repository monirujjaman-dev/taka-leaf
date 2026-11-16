using TakaLeaf.App.Data;

namespace TakaLeaf.App.Features.Health;

/// <summary>
/// GET /api/health - tells a monitor (and the web app's first screen) that the API is running
/// and whether it can reach PostgreSQL. The whole slice lives in this file.
/// </summary>
public static class GetHealth
{
    public sealed record Response(string Status, string Database);

    public static IEndpointRouteBuilder MapGetHealth(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/health", Handle).WithName("GetHealth").WithTags("Health");
        return routes;
    }

    private static async Task<IResult> Handle(AppDbContext db, CancellationToken cancellationToken)
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

        return Results.Ok(new Response("ok", databaseUp ? "up" : "down"));
    }
}
