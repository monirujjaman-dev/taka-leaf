using System.Net.Http.Headers;
using System.Net.Http.Json;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Support;
using static TakaLeaf.App.Tests.Features.Auth.AuthClient;

namespace TakaLeaf.App.Tests.Common;

[Collection(DatabaseCollection.Name)]
public class RequestLoggingTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    [Fact]
    public async Task A_signed_in_request_is_logged_with_the_user_and_the_ip()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        var session = await SignIn(client, email);

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        (await client.SendAsync(request)).EnsureSuccessStatusCode();

        var logged = await fixture.Factory.Logs.WaitForRequestAsync(
            "/api/auth/me", e => CapturedLogs.Text(e, "UserName") == email);
        Assert.Equal("200", CapturedLogs.Text(logged, "StatusCode"));
        Assert.Equal(session.User.Id.ToString(), CapturedLogs.Text(logged, "UserId"));
        Assert.False(string.IsNullOrEmpty(CapturedLogs.Text(logged, "ClientIp")));
        Assert.Contains(email, logged.RenderMessage());
    }

    [Fact]
    public async Task An_anonymous_request_is_logged_as_anonymous_without_the_body()
    {
        var client = auth.NewClient();
        var email = NewEmail();

        await client.PostAsJsonAsync("/api/auth/forgot-password", new { email });

        var logged = await fixture.Factory.Logs.WaitForRequestAsync("/api/auth/forgot-password");
        Assert.Equal("anonymous", CapturedLogs.Text(logged, "UserName"));
        Assert.DoesNotContain(email, logged.RenderMessage());
        Assert.DoesNotContain(logged.Properties.Values, value => value.ToString().Contains(email));
    }
}
