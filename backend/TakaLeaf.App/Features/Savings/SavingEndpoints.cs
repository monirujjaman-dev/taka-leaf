namespace TakaLeaf.App.Features.Savings;

/// <summary>FDR, DPS, savings certificates, prize bonds and insurance. See "Savings" in docs/ARCHITECTURE.md.</summary>
public static class SavingEndpoints
{
    public static IEndpointRouteBuilder MapSavings(this IEndpointRouteBuilder api)
    {
        api.MapGroup("/savings")
            .WithTags("Savings")
            .RequireAuthorization()
            .MapGetSavings()
            .MapAddSaving()
            .MapChangeSaving()
            .MapSavingActions();
        return api;
    }
}
