namespace TakaLeaf.App.Common;

public static class ValidationErrors
{
    /// <summary>A 400 response naming the field that needs fixing, in the standard problem format.</summary>
    public static IResult For(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
}
