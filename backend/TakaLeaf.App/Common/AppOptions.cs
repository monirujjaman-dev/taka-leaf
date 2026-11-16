namespace TakaLeaf.App.Common;

public sealed class AppOptions
{
    public const string Section = "App";

    /// <summary>Where the web app is served; links in emails point here.</summary>
    public string WebBaseUrl { get; set; } = "http://localhost:5173";
}
