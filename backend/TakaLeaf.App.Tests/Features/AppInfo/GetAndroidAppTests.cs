using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;

namespace TakaLeaf.App.Tests.Features.AppInfo;

[Collection(DatabaseCollection.Name)]
public class GetAndroidAppTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private sealed record AndroidApp(string DownloadUrl);

    [Fact]
    public async Task A_signed_in_person_gets_the_android_download()
    {
        var (client, _) = await auth.SignedInClient();

        var response = await client.GetAsync("/api/app/android");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var app = await response.Content.ReadFromJsonAsync<AndroidApp>();
        Assert.Equal("https://github.com/monirujjaman-dev/taka-leaf/releases/latest/download/takaleaf.apk", app!.DownloadUrl);
    }

    [Fact]
    public async Task Signed_out_visitors_are_not_offered_the_download()
    {
        var response = await auth.NewClient().GetAsync("/api/app/android");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("http://insecure.example/app.apk")]
    public async Task An_empty_or_insecure_address_hides_the_download(string url)
    {
        var (_, session) = await auth.SignedInClient();
        await using var app = fixture.Factory.WithWebHostBuilder(builder => builder.UseSetting("App:AndroidDownloadUrl", url));
        var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

        var response = await client.GetAsync("/api/app/android");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
