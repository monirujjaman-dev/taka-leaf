namespace TakaLeaf.App.Features.People;

public static class PeopleEndpoints
{
    public static IEndpointRouteBuilder MapPeople(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/people").WithTags("People").RequireAuthorization();
        group.MapGetPeople();
        group.MapGetPerson();
        group.MapAddPerson();
        group.MapUpdatePerson();
        group.MapDeletePerson();
        group.MapLoans();
        return api;
    }
}
