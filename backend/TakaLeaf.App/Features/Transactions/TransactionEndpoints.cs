namespace TakaLeaf.App.Features.Transactions;

public static class TransactionEndpoints
{
    public static IEndpointRouteBuilder MapTransactions(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/transactions").WithTags("Transactions").RequireAuthorization();
        group.MapListTransactions();
        group.MapExportTransactions();
        group.MapGetTransaction();
        group.MapAddTransaction();
        group.MapEditTransaction();
        group.MapDeleteTransaction();
        return api;
    }
}
