using System.Globalization;

namespace TakaLeaf.App.Common;

/// <summary>
/// Money is always a whole number of poisha (1 taka = 100 poisha); never a decimal or a double.
/// This must give the same text as formatBdt in packages/shared; both are tested against
/// contract/fixtures/money-format.json.
/// </summary>
public static class Money
{
    private const string Minus = "−";
    private const string Taka = "৳";

    public static string Format(long poisha)
    {
        var abs = Math.Abs(poisha);
        var taka = (abs / 100).ToString(CultureInfo.InvariantCulture);
        var rest = (abs % 100).ToString("00", CultureInfo.InvariantCulture);
        var sign = poisha < 0 ? Minus : string.Empty;
        return $"{sign}{Taka}{GroupBangladeshi(taka)}.{rest}";
    }

    /// <summary>Groups digits the Bangladeshi way: last three, then pairs (1,25,000).</summary>
    private static string GroupBangladeshi(string digits)
    {
        if (digits.Length <= 3)
        {
            return digits;
        }

        var tail = digits[^3..];
        var head = digits[..^3];
        var parts = new List<string>();
        while (head.Length > 2)
        {
            parts.Insert(0, head[^2..]);
            head = head[..^2];
        }

        if (head.Length > 0)
        {
            parts.Insert(0, head);
        }

        return $"{string.Join(",", parts)},{tail}";
    }
}
