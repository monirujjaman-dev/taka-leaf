namespace TakaLeaf.App.Features.Loans;

/// <summary>Bank loans and credit card EMIs (MapBankLoans: People already has MapLoans for money with friends). See "Loans" in docs/ARCHITECTURE.md.</summary>
public static class LoanEndpoints
{
    public static IEndpointRouteBuilder MapBankLoans(this IEndpointRouteBuilder api)
    {
        api.MapGroup("/loans")
            .WithTags("Loans")
            .RequireAuthorization()
            .MapGetLoans()
            .MapAddLoan()
            .MapChangeLoan()
            .MapLoanPayments();
        return api;
    }
}
