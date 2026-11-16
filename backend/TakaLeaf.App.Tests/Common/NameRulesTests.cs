using System.Text.Json;
using TakaLeaf.App.Common;

namespace TakaLeaf.App.Tests.Common;

public class NameRulesTests
{
    private sealed record Case(string? Input, string? Name, string? Error);

    public static TheoryData<string?, string?, string?> Fixture()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "person-name.json");
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var cases = JsonSerializer.Deserialize<List<Case>>(File.ReadAllText(path), options)!;

        var data = new TheoryData<string?, string?, string?>();
        foreach (var item in cases)
        {
            data.Add(item.Input, item.Name, item.Error);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Fixture))]
    public void Check_matches_the_shared_fixture(string? input, string? expectedName, string? expectedError)
    {
        var error = NameRules.Check(input, out var name);

        Assert.Equal(expectedError, error);
        if (expectedError is null)
        {
            Assert.Equal(expectedName, name);
        }
    }
}
