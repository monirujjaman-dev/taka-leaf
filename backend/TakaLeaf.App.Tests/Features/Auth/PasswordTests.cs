using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Tests.Data;
using static TakaLeaf.App.Tests.Features.Auth.AuthClient;

namespace TakaLeaf.App.Tests.Features.Auth;

/// <summary>Test cases A-7 to A-10 from the testing plan.</summary>
[Collection(DatabaseCollection.Name)]
public class PasswordTests(DatabaseFixture fixture)
{
    private const string NewPassword = "a-new-green-leaf-27";
    private readonly AuthClient auth = new(fixture);

    private static Task<HttpResponseMessage> Forgot(HttpClient client, string email) =>
        client.PostAsJsonAsync("/api/auth/forgot-password", new { email });

    private static Task<HttpResponseMessage> Reset(HttpClient client, string token, string password = NewPassword) =>
        client.PostAsJsonAsync("/api/auth/reset-password", new { token, password });

    private async Task<string> ResetLink(HttpClient client, string email)
    {
        (await Forgot(client, email)).EnsureSuccessStatusCode();
        return fixture.Factory.Emails.LatestToken(email);
    }

    // A-7
    [Fact]
    public async Task Forgot_password_answers_the_same_for_known_and_unknown_emails()
    {
        var client = auth.NewClient();
        var known = await auth.RegisterVerified(client);
        var unknown = NewEmail();

        var knownResponse = await Forgot(client, known);
        var unknownResponse = await Forgot(client, unknown);

        Assert.Equal(HttpStatusCode.Accepted, knownResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, unknownResponse.StatusCode);
        Assert.Equal(
            await knownResponse.Content.ReadFromJsonAsync<MessageResult>(),
            await unknownResponse.Content.ReadFromJsonAsync<MessageResult>());
        Assert.Contains(fixture.Factory.Emails.SentTo(known), m => m.Subject.Contains("Reset"));
        Assert.Empty(fixture.Factory.Emails.SentTo(unknown));
    }

    // A-9
    [Fact]
    public async Task Reset_sets_the_new_password_and_signs_out_everywhere()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        var before = await SignIn(client, email);

        var response = await Reset(client, await ResetLink(client, email));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login(client, email, NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Login(client, email)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, before.RefreshToken!)).StatusCode);
    }

    // A-8
    [Fact]
    public async Task A_reset_link_works_once()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        var link = await ResetLink(client, email);

        Assert.Equal(HttpStatusCode.OK, (await Reset(client, link)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(client, link, "yet-another-leaf-3")).StatusCode);
    }

    // A-8
    [Fact]
    public async Task An_expired_reset_link_is_refused()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        var link = await ResetLink(client, email);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hash = SecureToken.Hash(link);
            var token = await db.UserTokens.SingleAsync(t => t.TokenHash == hash);
            token.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(client, link)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login(client, email)).StatusCode);
    }

    [Fact]
    public async Task A_weak_new_password_is_refused_and_the_link_still_works()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        var link = await ResetLink(client, email);

        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(client, link, "1234567890")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Reset(client, link)).StatusCode);
    }

    [Fact]
    public async Task Only_the_newest_reset_link_matters_after_a_reset()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        var first = await ResetLink(client, email);
        var second = await ResetLink(client, email);

        Assert.Equal(HttpStatusCode.OK, (await Reset(client, second)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(client, first, "yet-another-leaf-3")).StatusCode);
    }

    [Fact]
    public async Task Reset_also_verifies_an_account_that_was_never_verified()
    {
        var client = auth.NewClient();
        var email = NewEmail();
        (await Register(client, email)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await Login(client, email)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Reset(client, await ResetLink(client, email))).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Login(client, email, NewPassword)).StatusCode);
    }

    [Fact]
    public async Task Reset_lifts_a_sign_in_lock()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        for (var i = 0; i < 5; i++)
        {
            await Login(client, email, "not-the-password-1");
        }

        Assert.Equal(HttpStatusCode.OK, (await Reset(client, await ResetLink(client, email))).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Login(client, email, NewPassword)).StatusCode);
    }

    // A-10
    [Fact]
    public async Task Change_password_with_a_wrong_current_password_is_refused()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        var session = await SignIn(client, email);

        var response = await PostAs(client, session.AccessToken, "/api/auth/change-password",
            new { currentPassword = "not-the-password-1", newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login(client, email)).StatusCode);
    }

    [Fact]
    public async Task Change_password_keeps_this_session_and_ends_the_others()
    {
        var client = auth.NewClient();
        var email = await auth.RegisterVerified(client);
        var here = await SignIn(client, email);
        var elsewhere = await SignIn(client, email);

        var response = await PostAs(client, here.AccessToken, "/api/auth/change-password",
            new { currentPassword = Password, newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refresh(client, here.RefreshToken!)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, elsewhere.RefreshToken!)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login(client, email, NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Login(client, email)).StatusCode);
        Assert.Contains(fixture.Factory.Emails.SentTo(email), m => m.Subject.Contains("was changed"));
    }

    [Fact]
    public async Task Change_password_refuses_the_same_password_and_needs_sign_in()
    {
        var client = auth.NewClient();
        var session = await SignIn(client, await auth.RegisterVerified(client));

        var same = await PostAs(client, session.AccessToken, "/api/auth/change-password",
            new { currentPassword = Password, newPassword = Password });
        var anonymous = await client.PostAsJsonAsync("/api/auth/change-password",
            new { currentPassword = Password, newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.BadRequest, same.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }
}
