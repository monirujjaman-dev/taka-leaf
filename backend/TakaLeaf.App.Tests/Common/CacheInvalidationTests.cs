using System.Net.Http.Json;
using System.Text.Json;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Common;

/// <summary>
/// The read endpoints are cached per user; a write must show up in every one of them at once,
/// and must not touch another account's cached answers.
/// </summary>
[Collection(DatabaseCollection.Name)]
public class CacheInvalidationTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private static async Task<JsonElement> Get(HttpClient client, string path) =>
        await client.GetFromJsonAsync<JsonElement>(path);

    private static string ThisMonth() => DateTime.UtcNow.AddHours(6).ToString("yyyy-MM");

    [Fact]
    public async Task A_new_expense_shows_at_once_in_every_cached_answer()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 500000 });
        var groceries = await TransactionTests.Category(client, "Expense", "Groceries and household");
        (await client.PostAsJsonAsync("/api/budgets", new { categoryId = groceries, amount = 1000000 })).EnsureSuccessStatusCode();
        var month = ThisMonth();

        // Fill the cache.
        Assert.Equal(500000, (await Get(client, "/api/wallets")).GetProperty("totals").GetProperty("net").GetInt64());
        Assert.Equal(0, (await Get(client, $"/api/dashboard?month={month}")).GetProperty("expense").GetInt64());
        Assert.Equal(0, (await Get(client, $"/api/reports?period=Month&month={month}")).GetProperty("expense").GetInt64());
        Assert.Equal(0, (await Get(client, $"/api/budgets?month={month}")).GetProperty("budgets")[0].GetProperty("spent").GetInt64());

        await TransactionTests.Add(client, new { type = "Expense", amount = 125000, fromWalletId = cash.Id, categoryId = groceries, occurredAt = DateTimeOffset.UtcNow });

        Assert.Equal(375000, (await Get(client, "/api/wallets")).GetProperty("totals").GetProperty("net").GetInt64());
        Assert.Equal(125000, (await Get(client, $"/api/dashboard?month={month}")).GetProperty("expense").GetInt64());
        Assert.Equal(125000, (await Get(client, $"/api/reports?period=Month&month={month}")).GetProperty("expense").GetInt64());
        Assert.Equal(125000, (await Get(client, $"/api/budgets?month={month}")).GetProperty("budgets")[0].GetProperty("spent").GetInt64());
    }

    [Fact]
    public async Task Renaming_a_wallet_or_adding_a_person_or_category_shows_at_once()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 0 });
        await Get(client, "/api/wallets");
        await Get(client, "/api/people");
        var before = (await Get(client, "/api/categories?kind=Expense")).GetArrayLength();

        (await client.PutAsJsonAsync($"/api/wallets/{cash.Id}", new { name = "Pocket cash" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/people", new { name = "Rafiq" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/categories", new { kind = "Expense", name = "Pets" })).EnsureSuccessStatusCode();

        Assert.Equal("Pocket cash", (await Get(client, "/api/wallets")).GetProperty("wallets")[0].GetProperty("name").GetString());
        Assert.Equal("Rafiq", (await Get(client, "/api/people")).GetProperty("people")[0].GetProperty("name").GetString());
        Assert.Equal(before + 1, (await Get(client, "/api/categories?kind=Expense")).GetArrayLength());
    }

    [Fact]
    public async Task Another_account_never_sees_or_changes_my_cached_answers()
    {
        var (mine, _) = await auth.SignedInClient();
        var (theirs, _) = await auth.SignedInClient();
        await WalletTests.Create(mine, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        await WalletTests.Create(theirs, new { type = "Cash", name = "Cash", openingBalance = 900000 });

        Assert.Equal(100000, (await Get(mine, "/api/wallets")).GetProperty("totals").GetProperty("net").GetInt64());
        Assert.Equal(900000, (await Get(theirs, "/api/wallets")).GetProperty("totals").GetProperty("net").GetInt64());

        await WalletTests.Create(theirs, new { type = "Bank", name = "Bank", openingBalance = 50000 });

        Assert.Equal(100000, (await Get(mine, "/api/wallets")).GetProperty("totals").GetProperty("net").GetInt64());
        Assert.Equal(950000, (await Get(theirs, "/api/wallets")).GetProperty("totals").GetProperty("net").GetInt64());
    }
}
