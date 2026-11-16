namespace TakaLeaf.App.Common;

public static class NotFound
{
    /// <summary>
    /// 404 for a row that does not exist or belongs to someone else. The two look the same, so
    /// nobody can learn which ids exist in other accounts.
    /// </summary>
    public static IResult Problem(string what) =>
        Results.Problem(title: $"{what} not found.", statusCode: StatusCodes.Status404NotFound);
}
