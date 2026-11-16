using System.Net.Mail;

namespace TakaLeaf.App.Common;

public static class EmailRules
{
    /// <summary>Accepts a plain address such as you@example.com and returns it trimmed and lower-cased.</summary>
    public static bool TryNormalize(string? input, out string normalized)
    {
        normalized = "";
        if (string.IsNullOrWhiteSpace(input))
        {
            return false;
        }

        var trimmed = input.Trim();
        if (trimmed.Length > 254
            || !MailAddress.TryCreate(trimmed, out var parsed)
            || parsed.Address != trimmed
            || !parsed.Host.Contains('.'))
        {
            return false;
        }

        normalized = trimmed.ToLowerInvariant();
        return true;
    }
}
