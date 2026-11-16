using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using TakaLeaf.App.Features.Auth;
using TakaLeaf.App.Tests.Data;

namespace TakaLeaf.App.Tests.Features.Auth;

/// <summary>Signed-in devices, immediate sign-out, and closing registration.</summary>
[Collection(DatabaseCollection.Name)]
public class SessionTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private sealed record SessionResult(Guid Id, string Device, DateTimeOffset SignedInAt, DateTimeOffset LastUsedAt, bool Current);

    private async Task<(HttpClient Client, AuthClient.AuthResult Session)> SignInAgain(string email, string userAgent)
    {
        var client = auth.NewClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd(userAgent);
        var session = await AuthClient.SignIn(client, email);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return (client, session);
    }

    [Fact]
    public async Task Devices_are_listed_and_a_signed_out_device_is_refused_at_once()
    {
        var email = await auth.RegisterVerified(auth.NewClient());
        var (laptop, _) = await SignInAgain(email, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36");
        var (phone, _) = await SignInAgain(email, "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36");

        var sessions = (await laptop.GetFromJsonAsync<List<SessionResult>>("/api/auth/sessions"))!;
        Assert.Equal(2, sessions.Count);
        Assert.Equal(("Chrome on Windows", true), (sessions[0].Device, sessions[0].Current));
        var phoneSession = Assert.Single(sessions, s => !s.Current);
        Assert.Equal("Chrome on Android", phoneSession.Device);

        Assert.Equal(HttpStatusCode.OK, (await phone.GetAsync("/api/wallets")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await laptop.DeleteAsync($"/api/auth/sessions/{phoneSession.Id}")).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await phone.GetAsync("/api/wallets")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync("/api/wallets")).StatusCode);
    }

    [Fact]
    public async Task Sign_out_others_keeps_this_device_and_logout_ends_the_access_token_too()
    {
        var email = await auth.RegisterVerified(auth.NewClient());
        var (here, _) = await SignInAgain(email, "Firefox/133.0 (X11; Linux x86_64)");
        var (other1, _) = await SignInAgain(email, "TakaLeaf/2.0 (Android 15)");
        var (other2, _) = await SignInAgain(email, "Safari/605 (Macintosh; Intel Mac OS X 14_0)");

        var result = await here.PostAsync("/api/auth/sessions/sign-out-others", null);
        Assert.Equal(2, (await result.Content.ReadFromJsonAsync<Sessions.SignedOut>())!.Count);
        Assert.Equal(HttpStatusCode.Unauthorized, (await other1.GetAsync("/api/wallets")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await other2.GetAsync("/api/wallets")).StatusCode);
        Assert.Single((await here.GetFromJsonAsync<List<SessionResult>>("/api/auth/sessions"))!);

        Assert.Equal(HttpStatusCode.NoContent, (await here.PostAsync("/api/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await here.GetAsync("/api/wallets")).StatusCode);
    }

    [Fact]
    public async Task Another_account_cannot_sign_out_my_device()
    {
        var (owner, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var mine = (await owner.GetFromJsonAsync<List<SessionResult>>("/api/auth/sessions"))!.Single();

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/auth/sessions/{mine.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/wallets")).StatusCode);
    }

    [Theory]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari on iOS")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0", "Edge on Windows")]
    [InlineData(null, "Unknown device")]
    public void Device_names_are_readable(string? userAgent, string expected) =>
        Assert.Equal(expected, DeviceName.From(userAgent));

    [Fact]
    public async Task Registration_can_be_closed()
    {
        await using var closed = fixture.Factory.WithWebHostBuilder(builder => builder.UseSetting("Auth:RegistrationOpen", "false"));
        var client = closed.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

        var response = await AuthClient.Register(client, AuthClient.NewEmail());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Contains("registration_closed", await response.Content.ReadAsStringAsync());
    }
}
