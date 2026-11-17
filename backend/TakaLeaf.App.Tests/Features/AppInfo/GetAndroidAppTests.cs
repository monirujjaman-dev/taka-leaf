using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using TakaLeaf.App.Tests.Data;

namespace TakaLeaf.App.Tests.Features.AppInfo;

[Collection(DatabaseCollection.Name)]
public class GetAndroidAppTests(DatabaseFixture fixture)
{
    private sealed record AndroidApp(string DownloadUrl);

    [Fact]
    public async Task Anyone_can_ask_where_the_android_app_is()
    {
        var response = await fixture.Factory.CreateClient().GetAsync("/api/app/android");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var app = await response.Content.ReadFromJsonAsync<AndroidApp>();
        Assert.Equal("https://github.com/monirujjaman-dev/taka-leaf/releases/latest/download/takaleaf.apk", app!.DownloadUrl);
    }

    [Theory]
    [InlineData("")]
    [InlineData("http://insecure.example/app.apk")]
    public async Task An_empty_or_insecure_address_hides_the_download(string url)
    {
        await using var app = fixture.Factory.WithWebHostBuilder(builder => builder.UseSetting("App:AndroidDownloadUrl", url));

        var response = await app.CreateClient().GetAsync("/api/app/android");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
