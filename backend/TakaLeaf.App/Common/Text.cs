namespace TakaLeaf.App.Common;

public static class Text
{
    /// <summary>Trims the value; blank becomes null.</summary>
    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>A message when an optional short label (icon or colour name) is too long, else null.</summary>
    public static string? LabelProblem(string? value, int max) =>
        value is not null && value.Length > max ? $"Use at most {max} characters." : null;
}
