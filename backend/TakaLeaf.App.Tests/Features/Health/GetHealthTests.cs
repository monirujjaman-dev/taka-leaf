using System.Net;
using System.Net.Http.Json;
using TakaLeaf.App.Tests.Data;

namespace TakaLeaf.App.Tests.Features.Health;

[Collection(DatabaseCollection.Name)]
public class GetHealthTests(DatabaseFixture fixture)
{
    private sealed record HealthResponse(string Status, string Database);

    [Fact]
    public async Task Health_endpoint_answers_ok_and_sees_the_database()
    {
        var client = fixture.Factory.CreateClient();

        var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.NotNull(body);
        Assert.Equal("ok", body.Status);
        Assert.Equal("up", body.Database);
    }
}
