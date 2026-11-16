using System.Text.Json;
using TakaLeaf.App.Common;

namespace TakaLeaf.App.Tests.Common;

public class MoneyTests
{
    private sealed record Case(long Poisha, string Text);

    public static TheoryData<long, string> Fixture()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "money-format.json");
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var cases = JsonSerializer.Deserialize<List<Case>>(File.ReadAllText(path), options)!;

        var data = new TheoryData<long, string>();
        foreach (var item in cases)
        {
            data.Add(item.Poisha, item.Text);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Fixture))]
    public void Format_matches_the_shared_fixture(long poisha, string expected)
    {
        Assert.Equal(expected, Money.Format(poisha));
    }
}
