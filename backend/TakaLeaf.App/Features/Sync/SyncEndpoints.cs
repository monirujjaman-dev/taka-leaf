namespace TakaLeaf.App.Features.Sync;

/// <summary>The Android app's sync: push its changes, pull everyone else's. See "Sync design" in docs/ARCHITECTURE.md.</summary>
public static class SyncEndpoints
{
    public static IEndpointRouteBuilder MapSync(this IEndpointRouteBuilder api)
    {
        api.MapGroup("/sync")
            .WithTags("Sync")
            .RequireAuthorization()
            .MapPullChanges()
            .MapPushChanges();
        return api;
    }
}
