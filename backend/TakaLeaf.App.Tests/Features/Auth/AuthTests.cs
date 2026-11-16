using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Tests.Data;

namespace TakaLeaf.App.Tests.Features.Auth;

/// <summary>Test cases A-1 to A-6 and X-2, X-5, X-6, X-8 from the testing plan.</summary>
[Collection(DatabaseCollection.Name)]
public class AuthTests(DatabaseFixture fixture)
{
    private const string Password = "green-leaf-2026";

    private sealed record AuthResult(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string? RefreshToken, UserResult User);

    private sealed record UserResult(Guid Id, string Email);

    private sealed record MessageResult(string Message);

    // https so the client keeps and sends the Secure refresh cookie.
    private HttpClient NewClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    private static string NewEmail() => $"{Guid.NewGuid():N}@example.test";

    private static Task<HttpResponseMessage> Register(HttpClient client, string email, string password = Password) =>
        client.PostAsJsonAsync("/api/auth/register", new { email, password });

    private static Task<HttpResponseMessage> Verify(HttpClient client, string token) =>
        client.PostAsJsonAsync("/api/auth/verify-email", new { token });

    private static Task<HttpResponseMessage> Login(HttpClient client, string email, string password = Password, string client_ = "mobile") =>
        client.PostAsJsonAsync("/api/auth/login", new { email, password, client = client_ });

    private static Task<HttpResponseMessage> RefreshWith(HttpClient client, string refreshToken) =>
        client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken });

    private async Task<string> RegisterVerified(HttpClient client)
    {
        var email = NewEmail();
        (await Register(client, email)).EnsureSuccessStatusCode();
        (await Verify(client, fixture.Factory.Emails.LatestToken(email))).EnsureSuccessStatusCode();
        return email;
    }

    private static async Task<AuthResult> SignIn(HttpClient client, string email)
    {
        var response = await Login(client, email);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthResult>())!;
    }

    // A-1
    [Fact]
    public async Task Register_sends_a_verification_email_and_sign_in_waits_for_it()
    {
        var client = NewClient();
        var email = NewEmail();

        var register = await Register(client, email);
        Assert.Equal(HttpStatusCode.Accepted, register.StatusCode);
        Assert.Single(fixture.Factory.Emails.SentTo(email));

        Assert.Equal(HttpStatusCode.Forbidden, (await Login(client, email)).StatusCode);

        var verify = await Verify(client, fixture.Factory.Emails.LatestToken(email));
        Assert.Equal(HttpStatusCode.OK, verify.StatusCode);

        var signedIn = await SignIn(client, email);
        Assert.Equal(email, signedIn.User.Email);
        Assert.False(string.IsNullOrEmpty(signedIn.AccessToken));
        Assert.False(string.IsNullOrEmpty(signedIn.RefreshToken));

        using var me = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        me.Headers.Authorization = new AuthenticationHeaderValue("Bearer", signedIn.AccessToken);
        var meResponse = await client.SendAsync(me);
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        Assert.Equal(email, (await meResponse.Content.ReadFromJsonAsync<UserResult>())!.Email);
    }

    [Fact]
    public async Task Email_is_matched_without_regard_to_case_or_spaces()
    {
        var client = NewClient();
        var email = await RegisterVerified(client);

        var response = await Login(client, $"  {email.ToUpperInvariant()} ");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // A-2
    [Fact]
    public async Task Registering_an_existing_email_answers_the_same_and_creates_nothing()
    {
        var client = NewClient();
        var email = await RegisterVerified(client);

        var again = await Register(client, email, "another-password-77");

        Assert.Equal(HttpStatusCode.Accepted, again.StatusCode);
        Assert.Equal(global::TakaLeaf.App.Features.Auth.Register.Message, (await again.Content.ReadFromJsonAsync<MessageResult>())!.Message);
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Users.CountAsync(u => u.Email == email));
        Assert.Contains(fixture.Factory.Emails.SentTo(email), m => m.Subject.Contains("already"));
        Assert.Equal(HttpStatusCode.OK, (await Login(client, email)).StatusCode);
    }

    // A-3
    [Theory]
    [InlineData("short-1")]
    [InlineData("1234567890")]
    [InlineData("password123")]
    [InlineData("aaaaaaaaaaaa")]
    public async Task Weak_passwords_are_refused(string password)
    {
        var response = await Register(NewClient(), NewEmail(), password);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("someone@localhost")]
    [InlineData("Name <someone@example.test>")]
    public async Task Invalid_emails_are_refused(string email)
    {
        var response = await Register(NewClient(), email);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task The_password_from_the_opened_link_is_the_one_that_counts()
    {
        var client = NewClient();
        var email = NewEmail();
        await Register(client, email, "first-password-11");
        var firstLink = fixture.Factory.Emails.LatestToken(email);
        await Register(client, email, "second-password-22");
        var secondLink = fixture.Factory.Emails.LatestToken(email);

        Assert.Equal(HttpStatusCode.OK, (await Verify(client, secondLink)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Login(client, email, "second-password-22")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Login(client, email, "first-password-11")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Verify(client, firstLink)).StatusCode);
    }

    [Fact]
    public async Task A_verification_link_works_once()
    {
        var client = NewClient();
        var email = NewEmail();
        await Register(client, email);
        var link = fixture.Factory.Emails.LatestToken(email);

        Assert.Equal(HttpStatusCode.OK, (await Verify(client, link)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Verify(client, link)).StatusCode);
    }

    [Fact]
    public async Task An_expired_verification_link_is_refused()
    {
        var client = NewClient();
        var email = NewEmail();
        await Register(client, email);
        var link = fixture.Factory.Emails.LatestToken(email);
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hash = SecureToken.Hash(link);
            var token = await db.UserTokens.SingleAsync(t => t.TokenHash == hash);
            token.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await Verify(client, link)).StatusCode);
    }

    [Fact]
    public async Task Resend_sends_a_new_link_for_an_unverified_account()
    {
        var client = NewClient();
        var email = NewEmail();
        await Register(client, email);

        var response = await client.PostAsJsonAsync("/api/auth/resend-verification", new { email });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(2, fixture.Factory.Emails.SentTo(email).Count);
        Assert.Equal(HttpStatusCode.OK, (await Verify(client, fixture.Factory.Emails.LatestToken(email))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login(client, email)).StatusCode);
    }

    [Fact]
    public async Task Wrong_email_and_wrong_password_get_the_same_answer()
    {
        var client = NewClient();
        var email = await RegisterVerified(client);

        var unknown = await Login(client, NewEmail());
        var wrong = await Login(client, email, "not-the-password-1");

        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(await unknown.Content.ReadAsStringAsync(), await wrong.Content.ReadAsStringAsync());
    }

    // A-5
    [Fact]
    public async Task Five_wrong_passwords_lock_sign_in_even_with_the_right_one()
    {
        var client = NewClient();
        var email = await RegisterVerified(client);

        for (var i = 0; i < 5; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await Login(client, email, "not-the-password-1")).StatusCode);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await Login(client, email)).StatusCode);
    }

    [Fact]
    public async Task Refresh_returns_new_tokens()
    {
        var client = NewClient();
        var signedIn = await SignIn(client, await RegisterVerified(client));

        var response = await RefreshWith(client, signedIn.RefreshToken!);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var refreshed = (await response.Content.ReadFromJsonAsync<AuthResult>())!;
        Assert.NotEqual(signedIn.RefreshToken, refreshed.RefreshToken);
        Assert.Equal(signedIn.User.Id, refreshed.User.Id);
    }

    // A-6
    [Fact]
    public async Task Reusing_an_old_refresh_token_ends_the_session()
    {
        var client = NewClient();
        var signedIn = await SignIn(client, await RegisterVerified(client));
        var refreshed = (await (await RefreshWith(client, signedIn.RefreshToken!)).Content.ReadFromJsonAsync<AuthResult>())!;
        await MoveUsedAtBack(signedIn.RefreshToken!, TimeSpan.FromMinutes(5));

        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshWith(client, signedIn.RefreshToken!)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshWith(client, refreshed.RefreshToken!)).StatusCode);
    }

    [Fact]
    public async Task Two_refreshes_at_the_same_moment_do_not_end_the_session()
    {
        var client = NewClient();
        var signedIn = await SignIn(client, await RegisterVerified(client));
        var refreshed = (await (await RefreshWith(client, signedIn.RefreshToken!)).Content.ReadFromJsonAsync<AuthResult>())!;

        Assert.Equal(HttpStatusCode.Conflict, (await RefreshWith(client, signedIn.RefreshToken!)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await RefreshWith(client, refreshed.RefreshToken!)).StatusCode);
    }

    // X-8
    [Fact]
    public async Task Web_sign_in_keeps_the_refresh_token_in_a_protected_cookie()
    {
        var client = NewClient();
        var email = await RegisterVerified(client);

        var login = await Login(client, email, Password, "web");

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Null((await login.Content.ReadFromJsonAsync<AuthResult>())!.RefreshToken);
        var cookie = Assert.Single(login.Headers.GetValues("Set-Cookie"), c => c.StartsWith("tl_refresh=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/auth", cookie, StringComparison.OrdinalIgnoreCase);

        var refresh = await client.PostAsJsonAsync("/api/auth/refresh", new { });
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        var client = NewClient();
        var signedIn = await SignIn(client, await RegisterVerified(client));

        using var logout = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        logout.Headers.Authorization = new AuthenticationHeaderValue("Bearer", signedIn.AccessToken);
        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(logout)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await RefreshWith(client, signedIn.RefreshToken!)).StatusCode);
    }

    // X-2
    [Fact]
    public async Task Protected_endpoints_refuse_missing_and_tampered_tokens()
    {
        var client = NewClient();
        var signedIn = await SignIn(client, await RegisterVerified(client));

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);

        using var tampered = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        tampered.Headers.Authorization = new AuthenticationHeaderValue("Bearer", signedIn.AccessToken[..^4] + "AAAA");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(tampered)).StatusCode);
    }

    // X-6
    [Fact]
    public async Task Passwords_and_link_tokens_are_never_stored_as_typed()
    {
        var client = NewClient();
        var email = NewEmail();
        await Register(client, email);
        var link = fixture.Factory.Emails.LatestToken(email);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(u => u.Email == email);
        Assert.DoesNotContain(Password, user.PasswordHash);
        Assert.False(await db.UserTokens.AnyAsync(t => t.TokenHash == link));
        Assert.True(await db.UserTokens.AnyAsync(t => t.UserId == user.Id && t.PasswordHash != null && !t.PasswordHash.Contains(Password)));
    }

    // X-5
    [Fact]
    public async Task Sign_in_attempts_are_rate_limited()
    {
        await using var limited = fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RateLimits:AuthPerMinute"] = "3",
            })));
        var client = limited.CreateClient();

        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await Login(client, NewEmail())).StatusCode);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await Login(client, NewEmail())).StatusCode);
    }

    private async Task MoveUsedAtBack(string refreshToken, TimeSpan by)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hash = SecureToken.Hash(refreshToken);
        var token = await db.RefreshTokens.SingleAsync(t => t.TokenHash == hash);
        token.UsedAt = token.UsedAt!.Value - by;
        await db.SaveChangesAsync();
    }
}
