using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using TakaLeaf.App.Tests.Data;

namespace TakaLeaf.App.Tests.Features.Auth;

/// <summary>The account holder's name: asked at registration, shown by /me, changed in Settings.</summary>
[Collection(DatabaseCollection.Name)]
public class NameTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private static Task<HttpResponseMessage> Register(HttpClient client, object body) => client.PostAsJsonAsync("/api/auth/register", body);

    [Fact]
    public async Task The_name_given_at_registration_comes_back_after_sign_in()
    {
        var client = auth.NewClient();
        var email = AuthClient.NewEmail();

        (await Register(client, new { name = "  Monir   Hossain ", email, password = AuthClient.Password })).EnsureSuccessStatusCode();
        var sent = fixture.Factory.Emails.SentTo(email).Last();
        Assert.Contains("Hi Monir Hossain,", sent.TextBody);
        Assert.Contains("Hi Monir Hossain,", sent.HtmlBody);
        Assert.Contains($"verify-email?token={fixture.Factory.Emails.LatestToken(email)}", sent.HtmlBody);
        (await client.PostAsJsonAsync("/api/auth/verify-email", new { token = fixture.Factory.Emails.LatestToken(email) })).EnsureSuccessStatusCode();

        var session = await AuthClient.SignIn(client, email);
        Assert.Equal("Monir Hossain", session.User.Name);

        using var me = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        me.Headers.Authorization = new("Bearer", session.AccessToken);
        var user = await (await client.SendAsync(me)).Content.ReadFromJsonAsync<AuthClient.UserResult>();
        Assert.Equal("Monir Hossain", user!.Name);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task Registration_needs_a_name(string? name)
    {
        var email = AuthClient.NewEmail();
        var response = await Register(auth.NewClient(), new { name, email, password = AuthClient.Password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal("Enter your name.", Assert.Single(problem!.Errors["name"]));
        Assert.Empty(fixture.Factory.Emails.SentTo(email));
    }

    [Fact]
    public async Task A_name_longer_than_100_characters_is_refused()
    {
        var response = await Register(auth.NewClient(), new { name = new string('a', 101), email = AuthClient.NewEmail(), password = AuthClient.Password });

        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal("Use 100 characters or fewer.", Assert.Single(problem!.Errors["name"]));
    }

    [Fact]
    public async Task Registering_again_before_verifying_uses_the_name_from_the_link_that_is_opened()
    {
        var client = auth.NewClient();
        var email = AuthClient.NewEmail();
        (await Register(client, new { name = "First Name", email, password = AuthClient.Password })).EnsureSuccessStatusCode();
        var firstLink = fixture.Factory.Emails.LatestToken(email);
        (await Register(client, new { name = "Second Name", email, password = AuthClient.Password })).EnsureSuccessStatusCode();

        (await client.PostAsJsonAsync("/api/auth/verify-email", new { token = firstLink })).EnsureSuccessStatusCode();

        Assert.Equal("First Name", (await AuthClient.SignIn(client, email)).User.Name);
    }

    [Fact]
    public async Task The_name_can_be_changed_in_settings()
    {
        var (client, _) = await auth.SignedInClient();

        var response = await client.PutAsJsonAsync("/api/auth/me", new { name = " Rafi  Ahmed " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Rafi Ahmed", (await response.Content.ReadFromJsonAsync<AuthClient.UserResult>())!.Name);
        var me = await client.GetFromJsonAsync<AuthClient.UserResult>("/api/auth/me");
        Assert.Equal("Rafi Ahmed", me!.Name);
    }

    [Fact]
    public async Task A_blank_name_is_refused_in_settings_and_nothing_changes()
    {
        var (client, session) = await auth.SignedInClient();

        var response = await client.PutAsJsonAsync("/api/auth/me", new { name = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var me = await client.GetFromJsonAsync<AuthClient.UserResult>("/api/auth/me");
        Assert.Equal(session.User.Name, me!.Name);
        Assert.Equal(AuthClient.TestName, me.Name);
    }

    [Fact]
    public async Task Changing_the_name_needs_a_signed_in_account()
    {
        var response = await auth.NewClient().PutAsJsonAsync("/api/auth/me", new { name = "Someone" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Changing_one_account_name_leaves_other_accounts_alone()
    {
        var (mine, _) = await auth.SignedInClient();
        var (theirs, _) = await auth.SignedInClient();

        (await mine.PutAsJsonAsync("/api/auth/me", new { name = "Only Me" })).EnsureSuccessStatusCode();

        Assert.Equal(AuthClient.TestName, (await theirs.GetFromJsonAsync<AuthClient.UserResult>("/api/auth/me"))!.Name);
    }
}
