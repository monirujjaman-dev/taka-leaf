using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;

namespace TakaLeaf.App.Features.AppInfo;

/// <summary>
/// GET /api/app/android - where to download the Android app, for the web app's download links.
/// Public, so the sign-in page can show it. 404 when App:AndroidDownloadUrl is empty.
/// </summary>
public static class GetAndroidApp
{
    public sealed record AndroidApp(string DownloadUrl);

    public static IEndpointRouteBuilder MapAppInfo(this IEndpointRouteBuilder api)
    {
        api.MapGet("/app/android", Handle).WithName("GetAndroidApp").WithTags("App").AllowAnonymous();
        return api;
    }

    private static IResult Handle(IOptions<AppOptions> options)
    {
        var url = options.Value.AndroidDownloadUrl.Trim();
        return Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps
            ? Results.Ok(new AndroidApp(url))
            : Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "The Android app is not offered on this server.");
    }
}
