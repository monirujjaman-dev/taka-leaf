namespace TakaLeaf.App.Features.Wallets;

public static class WalletEndpoints
{
    public static IEndpointRouteBuilder MapWallets(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/wallets").WithTags("Wallets").RequireAuthorization();
        group.MapGetWallets();
        group.MapGetWallet();
        group.MapCreateWallet();
        group.MapUpdateWallet();
        group.MapArchiveWallet();
        group.MapDeleteWallet();
        return api;
    }
}
