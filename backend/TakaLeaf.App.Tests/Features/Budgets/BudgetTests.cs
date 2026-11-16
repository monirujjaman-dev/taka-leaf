using System.Net;
using System.Net.Http.Json;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Budgets;

/// <summary>Monthly budgets (B-1 to B-4).</summary>
[Collection(DatabaseCollection.Name)]
public class BudgetTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private sealed record BudgetResult(Guid Id, Guid? CategoryId, string Name, long Amount, long Spent, long Remaining, int Percent, string Status);

    private sealed record ListResult(string Month, List<BudgetResult> Budgets);

    private static async Task<BudgetResult> Create(HttpClient client, Guid? categoryId, long amount)
    {
        var response = await client.PostAsJsonAsync("/api/budgets", new { categoryId, amount });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<BudgetResult>())!;
    }

    // B-1, B-2
    [Fact]
    public async Task Spending_is_counted_per_category_including_sub_categories_and_overall()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank", openingBalance = 10000000 });
        var housing = await TransactionTests.Category(client, "Expense", "Housing");
        var rent = await TransactionTests.Category(client, "Expense", "Housing", "House rent");
        var internet = await TransactionTests.Category(client, "Expense", "Housing", "Internet");
        var tea = await TransactionTests.Category(client, "Expense", "Food and dining", "Snacks and tea");
        await Create(client, null, 3000000);
        await Create(client, housing, 2000000);
        await Create(client, tea, 50000);

        await TransactionTests.Add(client, new { type = "Expense", amount = 1800000, fromWalletId = bank.Id, categoryId = rent });
        await TransactionTests.Add(client, new { type = "Expense", amount = 120000, fromWalletId = bank.Id, categoryId = internet });
        await TransactionTests.Add(client, new { type = "Expense", amount = 60000, fromWalletId = bank.Id, categoryId = tea });
        await TransactionTests.Add(client, new { type = "Expense", amount = 9999, fromWalletId = bank.Id, categoryId = tea, occurredAt = DateTimeOffset.UtcNow.AddDays(-40) });
        await TransactionTests.Add(client, new { type = "Income", amount = 500000, toWalletId = bank.Id });

        var list = (await client.GetFromJsonAsync<ListResult>("/api/budgets"))!;

        Assert.Equal(["All spending", "Housing", "Snacks and tea"], list.Budgets.Select(b => b.Name));
        var overall = list.Budgets[0];
        Assert.Equal((1980000L, 1020000L, 66, "OnTrack"), (overall.Spent, overall.Remaining, overall.Percent, overall.Status));
        var house = list.Budgets[1];
        Assert.Equal((1920000L, 96, "Near"), (house.Spent, house.Percent, house.Status));
        var snacks = list.Budgets[2];
        Assert.Equal((60000L, -10000L, "Over"), (snacks.Spent, snacks.Remaining, snacks.Status));
    }

    // B-3
    [Fact]
    public async Task One_budget_per_category_and_only_expense_categories()
    {
        var (client, _) = await auth.SignedInClient();
        var housing = await TransactionTests.Category(client, "Expense", "Housing");
        var salary = await TransactionTests.Category(client, "Income", "Salary");
        await Create(client, housing, 100);
        await Create(client, null, 100);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/budgets", new { categoryId = housing, amount = 200 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/budgets", new { amount = 200 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/budgets", new { categoryId = salary, amount = 200 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/budgets", new { categoryId = Guid.NewGuid(), amount = 200 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/budgets", new { amount = 0 })).StatusCode);
    }

    // B-4
    [Fact]
    public async Task A_budget_can_be_changed_and_removed_only_by_its_owner()
    {
        var (client, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var budget = await Create(client, null, 100000);

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PutAsJsonAsync($"/api/budgets/{budget.Id}", new { amount = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/budgets/{budget.Id}")).StatusCode);
        Assert.Empty((await stranger.GetFromJsonAsync<ListResult>("/api/budgets"))!.Budgets);

        var changed = await client.PutAsJsonAsync($"/api/budgets/{budget.Id}", new { amount = 250000 });
        Assert.Equal(250000, (await changed.Content.ReadFromJsonAsync<BudgetResult>())!.Amount);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/budgets/{budget.Id}")).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<ListResult>("/api/budgets"))!.Budgets);
        await Create(client, null, 100);
    }
}
