using System.Text.RegularExpressions;

namespace TakaLeaf.App.Common;

/// <summary>
/// The account holder's name: spaces trimmed and runs of spaces, tabs or new lines made one space;
/// 1 to 100 characters. The same cases are in contract/fixtures/person-name.json for the apps.
/// </summary>
public static partial class NameRules
{
    public const int MaxLength = 100;

    /// <summary>A plain sentence describing what is wrong, or null when <paramref name="name"/> is fine.</summary>
    public static string? Check(string? input, out string name)
    {
        name = Spaces().Replace(input ?? "", " ").Trim();
        if (name.Length == 0)
        {
            return "Enter your name.";
        }

        return name.Length > MaxLength ? $"Use {MaxLength} characters or fewer." : null;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
