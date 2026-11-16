using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Support;

namespace TakaLeaf.App.Tests.Features.Wallets;

/// <summary>Test cases W-1 to W-5, fixtures F-1 and F-3, and X-1 for wallets.</summary>
[Collection(DatabaseCollection.Name)]
public class WalletTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);
    private readonly TestData data = new(fixture);

    public sealed record WalletResult(
        Guid Id, string Type, string Name, long OpeningBalance, long Balance, long? CreditLimit, long? AvailableCredit,
        Guid? PersonId, string? Icon, string? Color, bool Archived, bool ExcludedFromTotal, int SortOrder);

    public sealed record TotalsResult(long Assets, long Liabilities, long Net);

    public sealed record WalletListResult(List<WalletResult> Wallets, TotalsResult Totals);

    public static async Task<WalletResult> Create(HttpClient client, object body)
    {
        var response = await client.PostAsJsonAsync("/api/wallets", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<WalletResult>())!;
    }

    private static async Task<WalletListResult> List(HttpClient client, bool includeArchived = false) =>
        (await client.GetFromJsonAsync<WalletListResult>($"/api/wallets?includeArchived={includeArchived.ToString().ToLowerInvariant()}"))!;

    // W-1
    [Fact]
    public async Task Each_wallet_type_can_be_created_with_its_opening_balance()
    {
        var (client, _) = await auth.SignedInClient();

        var cash = await Create(client, new { type = "Cash", name = "Cash", openingBalance = 625000 });
        await Create(client, new { type = "Bank", name = "Bank account", openingBalance = 17910000 });
        await Create(client, new { type = "Mfs", name = "bKash", openingBalance = 1240000, icon = "phone" });
        await Create(client, new { type = "CreditCard", name = "Credit card", creditLimit = 10000000 });

        Assert.Equal(625000, cash.Balance);
        var list = await List(client);
        Assert.Equal(["Cash", "Bank account", "bKash", "Credit card"], list.Wallets.Select(w => w.Name));
        Assert.Equal(["Cash", "Bank", "Mfs", "CreditCard"], list.Wallets.Select(w => w.Type));
        Assert.Equal(625000 + 17910000 + 1240000, list.Totals.Net);
    }

    // F-1
    [Fact]
    public async Task Balance_is_opening_plus_money_in_minus_money_out()
    {
        var (client, session) = await auth.SignedInClient();
        var bank = await Create(client, new { type = "Bank", name = "Bank account", openingBalance = 500000 });
        var cash = await Create(client, new { type = "Cash", name = "Cash" });

        await data.AddTransaction(session.User.Id, TransactionType.Income, 8500000, to: bank.Id);
        await data.AddTransaction(session.User.Id, TransactionType.Expense, 125000, from: bank.Id);
        await data.AddTransaction(session.User.Id, TransactionType.Transfer, 1000000, from: bank.Id, to: cash.Id);

        var list = await List(client);
        Assert.Equal(7875000, list.Wallets.Single(w => w.Id == bank.Id).Balance);
        Assert.Equal(1000000, list.Wallets.Single(w => w.Id == cash.Id).Balance);
        Assert.Equal(8875000, list.Totals.Net);
    }

    // W-4, F-3
    [Fact]
    public async Task A_credit_card_shows_what_is_owed_and_what_is_left()
    {
        var (client, session) = await auth.SignedInClient();
        var card = await Create(client, new { type = "CreditCard", name = "Credit card", creditLimit = 10000000 });
        var bank = await Create(client, new { type = "Bank", name = "Bank account", openingBalance = 5000000 });

        await data.AddTransaction(session.User.Id, TransactionType.Expense, 240000, from: card.Id);
        var owing = (await client.GetFromJsonAsync<WalletResult>($"/api/wallets/{card.Id}"))!;
        Assert.Equal(-240000, owing.Balance);
        Assert.Equal(9760000, owing.AvailableCredit);
        var totals = (await List(client)).Totals;
        Assert.Equal(5000000, totals.Assets);
        Assert.Equal(240000, totals.Liabilities);
        Assert.Equal(4760000, totals.Net);

        await data.AddTransaction(session.User.Id, TransactionType.Transfer, 240000, from: bank.Id, to: card.Id);
        var paid = (await client.GetFromJsonAsync<WalletResult>($"/api/wallets/{card.Id}"))!;
        Assert.Equal(0, paid.Balance);
        Assert.Equal(10000000, paid.AvailableCredit);
    }

    // W-5
    [Fact]
    public async Task A_wallet_hidden_from_the_total_keeps_its_own_balance()
    {
        var (client, _) = await auth.SignedInClient();
        await Create(client, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var savings = await Create(client, new { type = "Bank", name = "Savings", openingBalance = 900000, excludedFromTotal = true });

        var list = await List(client);

        Assert.Equal(100000, list.Totals.Net);
        Assert.Equal(900000, list.Wallets.Single(w => w.Id == savings.Id).Balance);
    }

    // W-2
    [Fact]
    public async Task An_archived_wallet_leaves_the_list_but_still_counts()
    {
        var (client, _) = await auth.SignedInClient();
        var old = await Create(client, new { type = "Bank", name = "Old bank", openingBalance = 300000 });

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/wallets/{old.Id}/archive", null)).StatusCode);

        Assert.DoesNotContain(old.Id, (await List(client)).Wallets.Select(w => w.Id));
        Assert.Contains(old.Id, (await List(client, includeArchived: true)).Wallets.Select(w => w.Id));
        Assert.Equal(300000, (await List(client)).Totals.Net);

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/wallets/{old.Id}/unarchive", null)).StatusCode);
        Assert.Contains(old.Id, (await List(client)).Wallets.Select(w => w.Id));
    }

    // W-3
    [Fact]
    public async Task A_wallet_with_transactions_cannot_be_deleted()
    {
        var (client, session) = await auth.SignedInClient();
        var used = await Create(client, new { type = "Cash", name = "Cash" });
        var unused = await Create(client, new { type = "Mfs", name = "Nagad" });
        await data.AddTransaction(session.User.Id, TransactionType.Income, 50000, to: used.Id);

        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/wallets/{used.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/wallets/{unused.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/wallets/{unused.Id}")).StatusCode);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.NotNull((await db.Wallets.IgnoreQueryFilters().SingleAsync(w => w.Id == unused.Id)).DeletedAt);
    }

    [Fact]
    public async Task Renaming_and_changing_a_wallet_works_but_its_type_stays()
    {
        var (client, _) = await auth.SignedInClient();
        var card = await Create(client, new { type = "CreditCard", name = "Card", creditLimit = 5000000 });

        var response = await client.PutAsJsonAsync($"/api/wallets/{card.Id}",
            new { name = "City Bank card", openingBalance = -100000, creditLimit = 8000000, color = "teal" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = (await response.Content.ReadFromJsonAsync<WalletResult>())!;
        Assert.Equal("City Bank card", updated.Name);
        Assert.Equal("CreditCard", updated.Type);
        Assert.Equal(-100000, updated.Balance);
        Assert.Equal(7900000, updated.AvailableCredit);
    }

    [Theory]
    [InlineData("""{ "type": "Cash", "name": "" }""")]
    [InlineData("""{ "type": "Cash" }""")]
    [InlineData("""{ "name": "No type" }""")]
    [InlineData("""{ "type": "Lent", "name": "Rafiq" }""")]
    [InlineData("""{ "type": "Cash", "name": "Cash", "creditLimit": 1000 }""")]
    [InlineData("""{ "type": "CreditCard", "name": "Card", "creditLimit": 0 }""")]
    [InlineData("""{ "type": "Piggy", "name": "Jar" }""")]
    public async Task Invalid_wallets_are_refused(string json)
    {
        var (client, _) = await auth.SignedInClient();

        var response = await client.PostAsync("/api/wallets", new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Two_wallets_cannot_share_a_name()
    {
        var (client, _) = await auth.SignedInClient();
        await Create(client, new { type = "Mfs", name = "bKash" });

        var response = await client.PostAsJsonAsync("/api/wallets", new { type = "Mfs", name = " BKASH " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // X-1
    [Fact]
    public async Task Another_account_cannot_see_or_change_a_wallet()
    {
        var (owner, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var wallet = await Create(owner, new { type = "Cash", name = "Cash", openingBalance = 100000 });

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/wallets/{wallet.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PutAsJsonAsync($"/api/wallets/{wallet.Id}", new { name = "Mine" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsync($"/api/wallets/{wallet.Id}/archive", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/wallets/{wallet.Id}")).StatusCode);
        Assert.Empty((await List(stranger)).Wallets);
        Assert.Equal("Cash", (await owner.GetFromJsonAsync<WalletResult>($"/api/wallets/{wallet.Id}"))!.Name);
    }

    [Fact]
    public async Task Wallets_need_sign_in()
    {
        var client = auth.NewClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/wallets")).StatusCode);
    }
}
