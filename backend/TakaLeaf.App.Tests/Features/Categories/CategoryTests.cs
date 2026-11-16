using System.Net;
using System.Net.Http.Json;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;
using TakaLeaf.App.Tests.Support;

namespace TakaLeaf.App.Tests.Features.Categories;

/// <summary>Test cases C-1 to C-4 and X-1 for categories.</summary>
[Collection(DatabaseCollection.Name)]
public class CategoryTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);
    private readonly TestData data = new(fixture);

    public sealed record CategoryResult(
        Guid Id, string Kind, string Name, Guid? ParentId, string? Icon, string? Color, bool Archived, List<CategoryResult> Children);

    private sealed record MergeResult(int MovedTransactions);

    private static async Task<List<CategoryResult>> List(HttpClient client, string kind, bool includeArchived = false) =>
        (await client.GetFromJsonAsync<List<CategoryResult>>(
            $"/api/categories?kind={kind}&includeArchived={includeArchived.ToString().ToLowerInvariant()}"))!;

    private static async Task<CategoryResult> Create(HttpClient client, object body)
    {
        var response = await client.PostAsJsonAsync("/api/categories", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<CategoryResult>())!;
    }

    // C-4
    [Fact]
    public async Task A_new_account_starts_with_the_starter_categories()
    {
        var (client, _) = await auth.SignedInClient();

        var expense = await List(client, "Expense");
        var income = await List(client, "Income");

        Assert.Equal(StarterCategories.ParentCount(CategoryKind.Expense), expense.Count);
        Assert.Equal(StarterCategories.ParentCount(CategoryKind.Income), income.Count);
        Assert.Equal("Housing", expense[0].Name);
        Assert.Equal(["House rent", "Utilities", "Internet", "Maintenance"], expense[0].Children.Select(c => c.Name));
        Assert.Contains(expense, c => c.Name == "Learning tools" && c.Children.Any(s => s.Name == "AI subscriptions"));
        Assert.Equal("Salary", income[0].Name);
        Assert.All(expense.SelectMany(c => c.Children), c => Assert.Equal("Expense", c.Kind));
    }

    // C-2 (two levels)
    [Fact]
    public async Task Categories_and_sub_categories_can_be_added_but_only_two_levels_deep()
    {
        var (client, _) = await auth.SignedInClient();
        var pets = await Create(client, new { kind = "Expense", name = "Pets", icon = "paw" });
        var food = await Create(client, new { parentId = pets.Id, name = "Pet food" });

        Assert.Equal("Expense", food.Kind);
        Assert.Contains(await List(client, "Expense"), c => c.Id == pets.Id && c.Children.Single().Id == food.Id);

        var third = await client.PostAsJsonAsync("/api/categories", new { parentId = food.Id, name = "Dry food" });
        Assert.Equal(HttpStatusCode.BadRequest, third.StatusCode);

        var wrongKind = await client.PostAsJsonAsync("/api/categories", new { kind = "Income", parentId = pets.Id, name = "Sold kittens" });
        Assert.Equal(HttpStatusCode.BadRequest, wrongKind.StatusCode);

        var duplicate = await client.PostAsJsonAsync("/api/categories", new { parentId = pets.Id, name = "pet FOOD" });
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
    }

    [Fact]
    public async Task A_category_can_be_renamed()
    {
        var (client, _) = await auth.SignedInClient();
        var housing = (await List(client, "Expense")).First(c => c.Name == "Housing");

        var response = await client.PutAsJsonAsync($"/api/categories/{housing.Id}", new { name = "Home", icon = "home" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(await List(client, "Expense"), c => c.Id == housing.Id && c.Name == "Home");
    }

    // C-1
    [Fact]
    public async Task Merging_moves_every_transaction_and_keeps_the_totals()
    {
        var (client, session) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 1000000 });
        var transport = (await List(client, "Expense")).First(c => c.Name == "Transport");
        var bus = transport.Children.First(c => c.Name == "Bus fare");
        var rickshaw = transport.Children.First(c => c.Name == "Rickshaw and CNG");
        await data.AddTransaction(session.User.Id, TransactionType.Expense, 6000, from: cash.Id, categoryId: bus.Id);
        await data.AddTransaction(session.User.Id, TransactionType.Expense, 4000, from: cash.Id, categoryId: bus.Id);
        await data.AddTransaction(session.User.Id, TransactionType.Expense, 12000, from: cash.Id, categoryId: rickshaw.Id);

        var response = await client.PostAsJsonAsync($"/api/categories/{bus.Id}/merge", new { intoCategoryId = rickshaw.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, (await response.Content.ReadFromJsonAsync<MergeResult>())!.MovedTransactions);
        var after = (await List(client, "Expense")).First(c => c.Id == transport.Id);
        Assert.DoesNotContain(after.Children, c => c.Id == bus.Id);
        var wallet = (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{cash.Id}"))!;
        Assert.Equal(1000000 - 22000, wallet.Balance);
    }

    [Fact]
    public async Task Merging_needs_the_same_kind_and_no_sub_categories()
    {
        var (client, _) = await auth.SignedInClient();
        var expense = await List(client, "Expense");
        var salary = (await List(client, "Income")).First(c => c.Name == "Salary");
        var housing = expense.First(c => c.Name == "Housing");
        var rent = housing.Children.First();

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync($"/api/categories/{rent.Id}/merge", new { intoCategoryId = salary.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync($"/api/categories/{housing.Id}/merge", new { intoCategoryId = expense[1].Id })).StatusCode);
    }

    // C-2 (archive)
    [Fact]
    public async Task Archiving_a_category_takes_its_sub_categories_along()
    {
        var (client, _) = await auth.SignedInClient();
        var health = (await List(client, "Expense")).First(c => c.Name == "Health");
        var doctor = health.Children.First();

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync($"/api/categories/{health.Id}/archive", null)).StatusCode);

        Assert.DoesNotContain(await List(client, "Expense"), c => c.Id == health.Id);
        var archived = (await List(client, "Expense", includeArchived: true)).First(c => c.Id == health.Id);
        Assert.True(archived.Archived);
        Assert.All(archived.Children, c => Assert.True(c.Archived));
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/categories/{doctor.Id}/unarchive", null)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync($"/api/categories/{health.Id}/unarchive", null)).StatusCode);
        Assert.All((await List(client, "Expense")).First(c => c.Id == health.Id).Children, c => Assert.False(c.Archived));
    }

    [Fact]
    public async Task A_category_in_use_or_with_sub_categories_cannot_be_deleted()
    {
        var (client, session) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var personal = (await List(client, "Expense")).First(c => c.Name == "Personal");
        var clothing = personal.Children.First(c => c.Name == "Clothing");
        var grooming = personal.Children.First(c => c.Name == "Grooming");
        await data.AddTransaction(session.User.Id, TransactionType.Expense, 150000, from: cash.Id, categoryId: clothing.Id);

        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/categories/{personal.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/categories/{clothing.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/categories/{grooming.Id}")).StatusCode);
        Assert.DoesNotContain((await List(client, "Expense")).First(c => c.Id == personal.Id).Children, c => c.Id == grooming.Id);
    }

    // X-1
    [Fact]
    public async Task Another_account_cannot_see_or_change_a_category()
    {
        var (owner, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var housing = (await List(owner, "Expense")).First(c => c.Name == "Housing");
        var theirs = (await List(stranger, "Expense")).First(c => c.Name == "Housing");

        Assert.NotEqual(housing.Id, theirs.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PutAsJsonAsync($"/api/categories/{housing.Id}", new { name = "Mine" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsync($"/api/categories/{housing.Id}/archive", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/categories/{housing.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await stranger.PostAsJsonAsync("/api/categories", new { parentId = housing.Id, name = "Sneaky" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await stranger.PostAsJsonAsync($"/api/categories/{housing.Id}/merge", new { intoCategoryId = theirs.Id })).StatusCode);
    }

    [Fact]
    public async Task Merging_moves_recurring_rules_and_the_budget_and_delete_respects_them()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var bus = await TransactionTests.Category(client, "Expense", "Transport", "Bus fare");
        var cng = await TransactionTests.Category(client, "Expense", "Transport", "Rickshaw and CNG");
        var fuel = await TransactionTests.Category(client, "Expense", "Transport", "Fuel");
        var rule = await client.PostAsJsonAsync("/api/recurring", new { type = "Expense", amount = 100, fromWalletId = cash.Id, categoryId = bus, frequency = "Monthly", startDate = "2027-01-01" });
        var ruleId = (await rule.Content.ReadFromJsonAsync<IdResult>())!.Id;
        await client.PostAsJsonAsync("/api/budgets", new { categoryId = bus, amount = 5000 });
        await client.PostAsJsonAsync("/api/budgets", new { categoryId = fuel, amount = 9000 });

        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/categories/{bus}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync($"/api/categories/{bus}/merge", new { intoCategoryId = cng })).StatusCode);

        Assert.Equal(cng, (await client.GetFromJsonAsync<RuleResult>($"/api/recurring/{ruleId}"))!.CategoryId);
        var budgets = (await client.GetFromJsonAsync<BudgetList>("/api/budgets"))!.Budgets;
        Assert.Contains(budgets, b => b.CategoryId == cng && b.Amount == 5000);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/categories/{fuel}")).StatusCode);
        Assert.DoesNotContain((await client.GetFromJsonAsync<BudgetList>("/api/budgets"))!.Budgets, b => b.CategoryId == fuel);
    }

    private sealed record IdResult(Guid Id);

    private sealed record RuleResult(Guid Id, Guid? CategoryId);

    private sealed record BudgetItem(Guid? CategoryId, long Amount);

    private sealed record BudgetList(List<BudgetItem> Budgets);
}
