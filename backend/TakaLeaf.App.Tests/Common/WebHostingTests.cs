using System.Net;
using TakaLeaf.App.Tests.Data;

namespace TakaLeaf.App.Tests.Common;

/// <summary>How the app answers as a website: unknown API addresses and protective headers.</summary>
[Collection(DatabaseCollection.Name)]
public class WebHostingTests(DatabaseFixture fixture)
{
    [Fact]
    public async Task An_unknown_api_address_is_a_404_problem()
    {
        var client = fixture.Factory.CreateClient();

        var response = await client.GetAsync("/api/no-such-thing/here");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Responses_carry_security_headers()
    {
        var client = fixture.Factory.CreateClient();

        var response = await client.GetAsync("/api/health");

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Contains("frame-ancestors 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
    }
}
