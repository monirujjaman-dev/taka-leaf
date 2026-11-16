namespace TakaLeaf.App.Common;

public sealed class AppOptions
{
    public const string Section = "App";

    /// <summary>Where the web app is served; links in emails point here.</summary>
    public string WebBaseUrl { get; set; } = "http://localhost:5173";

    /// <summary>Days and months (filters, reports) are counted in this time zone.</summary>
    public string TimeZone { get; set; } = "Asia/Dhaka";
}
