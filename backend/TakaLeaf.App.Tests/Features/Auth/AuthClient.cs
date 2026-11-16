using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using TakaLeaf.App.Tests.Data;

namespace TakaLeaf.App.Tests.Features.Auth;

/// <summary>Small helpers shared by the auth tests.</summary>
public sealed class AuthClient(DatabaseFixture fixture)
{
    public const string Password = "green-leaf-2026";

    public sealed record AuthResult(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string? RefreshToken, UserResult User);

    public sealed record UserResult(Guid Id, string Email);

    public sealed record MessageResult(string Message);

    // https so the client keeps and sends the Secure refresh cookie.
    public HttpClient NewClient() =>
        fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    public static string NewEmail() => $"{Guid.NewGuid():N}@example.test";

    public static Task<HttpResponseMessage> Register(HttpClient client, string email, string password = Password) =>
        client.PostAsJsonAsync("/api/auth/register", new { email, password });

    public static Task<HttpResponseMessage> Login(HttpClient client, string email, string password = Password) =>
        client.PostAsJsonAsync("/api/auth/login", new { email, password, client = "mobile" });

    public static Task<HttpResponseMessage> Refresh(HttpClient client, string refreshToken) =>
        client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken });

    public static Task<HttpResponseMessage> PostAs(HttpClient client, string accessToken, string path, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client.SendAsync(request);
    }

    public async Task<string> RegisterVerified(HttpClient client)
    {
        var email = NewEmail();
        (await Register(client, email)).EnsureSuccessStatusCode();
        var token = fixture.Factory.Emails.LatestToken(email);
        (await client.PostAsJsonAsync("/api/auth/verify-email", new { token })).EnsureSuccessStatusCode();
        return email;
    }

    public static async Task<AuthResult> SignIn(HttpClient client, string email, string password = Password)
    {
        var response = await Login(client, email, password);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthResult>())!;
    }
}
