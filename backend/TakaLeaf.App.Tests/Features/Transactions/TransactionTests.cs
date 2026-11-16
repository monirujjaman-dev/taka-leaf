using System.Net;
using System.Net.Http.Json;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Categories;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Transactions;

/// <summary>Test cases T-1 to T-7, fixture F-2, and X-1 for transactions.</summary>
[Collection(DatabaseCollection.Name)]
public class TransactionTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    public sealed record TransactionResult(
        Guid Id, string Type, long Amount, Guid? FromWalletId, string? FromWalletName, Guid? ToWalletId, string? ToWalletName,
        Guid? CategoryId, string? CategoryName, Guid? PersonId, Guid? FeeOfId, long? Fee, DateTimeOffset OccurredAt, string? Note);

    private sealed record TotalsResult(long Income, long Expense);

    private sealed record PageResult(List<TransactionResult> Items, int TotalCount, int Page, int PageSize, TotalsResult Totals);

    public static async Task<TransactionResult> Add(HttpClient client, object body)
    {
        var response = await client.PostAsJsonAsync("/api/transactions", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TransactionResult>())!;
    }

    private static async Task<long> Balance(HttpClient client, Guid walletId) =>
        (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{walletId}"))!.Balance;

    private static async Task<PageResult> History(HttpClient client, string query = "") =>
        (await client.GetFromJsonAsync<PageResult>($"/api/transactions{query}"))!;

    public static async Task<Guid> Category(HttpClient client, string kind, string parent, string? child = null)
    {
        var categories = (await client.GetFromJsonAsync<List<CategoryTests.CategoryResult>>($"/api/categories?kind={kind}"))!;
        var top = categories.First(c => c.Name == parent);
        return child is null ? top.Id : top.Children.First(c => c.Name == child).Id;
    }

    // T-1
    [Fact]
    public async Task An_expense_lowers_the_wallet_and_comes_first_in_history()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 625000 });
        var bazaar = await Category(client, "Expense", "Groceries and household", "Daily bazaar");
        await Add(client, new { type = "Expense", amount = 6000, fromWalletId = cash.Id, occurredAt = "2026-11-01T09:00:00+06:00" });

        var added = await Add(client, new { type = "Expense", amount = 125000, fromWalletId = cash.Id, categoryId = bazaar, note = "Weekly bazaar" });

        Assert.Equal(625000 - 6000 - 125000, await Balance(client, cash.Id));
        Assert.Equal("Daily bazaar", added.CategoryName);
        Assert.Equal("Cash", added.FromWalletName);
        Assert.Equal(added.Id, (await History(client)).Items[0].Id);
    }

    // T-2
    [Fact]
    public async Task An_income_raises_the_wallet()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank account" });
        var salary = await Category(client, "Income", "Salary", "Monthly salary");

        await Add(client, new { type = "Income", amount = 8500000, toWalletId = bank.Id, categoryId = salary });

        Assert.Equal(8500000, await Balance(client, bank.Id));
    }

    // T-3, F-2
    [Fact]
    public async Task A_transfer_with_a_fee_moves_the_money_and_counts_the_fee_as_an_expense()
    {
        var (client, _) = await auth.SignedInClient();
        var bkash = await WalletTests.Create(client, new { type = "Mfs", name = "bKash", openingBalance = 1240000 });
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });

        var transfer = await Add(client, new { type = "Transfer", amount = 500000, fromWalletId = bkash.Id, toWalletId = cash.Id, fee = 9250 });

        Assert.Equal(9250, transfer.Fee);
        Assert.Equal(730750, await Balance(client, bkash.Id));
        Assert.Equal(500000, await Balance(client, cash.Id));
        var history = await History(client);
        var feeRow = history.Items.Single(t => t.FeeOfId == transfer.Id);
        Assert.Equal("Expense", feeRow.Type);
        Assert.Equal("Fees and charges", feeRow.CategoryName);
        Assert.Equal(new TotalsResult(0, 9250), history.Totals);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync($"/api/transactions/{feeRow.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/transactions/{transfer.Id}")).StatusCode);
        Assert.Equal(1240000, await Balance(client, bkash.Id));
        Assert.Equal(0, await Balance(client, cash.Id));
        Assert.Empty((await History(client)).Items);
    }

    [Fact]
    public async Task Changing_or_removing_a_transfer_fee_keeps_the_fee_row_in_step()
    {
        var (client, _) = await auth.SignedInClient();
        var bkash = await WalletTests.Create(client, new { type = "Mfs", name = "bKash", openingBalance = 1000000 });
        var nagad = await WalletTests.Create(client, new { type = "Mfs", name = "Nagad", openingBalance = 1000000 });
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var transfer = await Add(client, new { type = "Transfer", amount = 100000, fromWalletId = bkash.Id, toWalletId = cash.Id, fee = 1850 });

        var moved = await client.PutAsJsonAsync($"/api/transactions/{transfer.Id}",
            new { type = "Transfer", amount = 100000, fromWalletId = nagad.Id, toWalletId = cash.Id, fee = 2000 });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Equal(1000000, await Balance(client, bkash.Id));
        Assert.Equal(1000000 - 100000 - 2000, await Balance(client, nagad.Id));

        var noFee = await client.PutAsJsonAsync($"/api/transactions/{transfer.Id}",
            new { type = "Transfer", amount = 100000, fromWalletId = nagad.Id, toWalletId = cash.Id });
        Assert.Equal(HttpStatusCode.OK, noFee.StatusCode);
        Assert.Equal(1000000 - 100000, await Balance(client, nagad.Id));
        Assert.DoesNotContain((await History(client)).Items, t => t.FeeOfId == transfer.Id);
    }

    // T-4
    [Fact]
    public async Task Editing_moves_the_amount_between_wallets()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 500000 });
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank account", openingBalance = 500000 });
        var expense = await Add(client, new { type = "Expense", amount = 100000, fromWalletId = cash.Id });

        var response = await client.PutAsJsonAsync($"/api/transactions/{expense.Id}",
            new { type = "Expense", amount = 150000, fromWalletId = bank.Id, occurredAt = "2026-11-05T20:00:00+06:00", note = "Moved" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(500000, await Balance(client, cash.Id));
        Assert.Equal(350000, await Balance(client, bank.Id));
        var edited = (await response.Content.ReadFromJsonAsync<TransactionResult>())!;
        Assert.Equal(DateTimeOffset.Parse("2026-11-05T14:00:00Z"), edited.OccurredAt);
        Assert.Equal("Moved", edited.Note);
    }

    // T-5
    [Fact]
    public async Task Deleting_restores_the_balance()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 500000 });
        var expense = await Add(client, new { type = "Expense", amount = 120000, fromWalletId = cash.Id });

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/transactions/{expense.Id}")).StatusCode);

        Assert.Equal(500000, await Balance(client, cash.Id));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/transactions/{expense.Id}")).StatusCode);
    }

    // T-6
    [Fact]
    public async Task Invalid_transactions_are_refused()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank" });
        var old = await WalletTests.Create(client, new { type = "Bank", name = "Old bank" });
        await client.PostAsync($"/api/wallets/{old.Id}/archive", null);
        var salary = await Category(client, "Income", "Salary");
        var rent = await Category(client, "Expense", "Housing", "House rent");

        object[] bad =
        [
            new { type = "Expense", amount = 0, fromWalletId = cash.Id },
            new { type = "Expense", amount = -500, fromWalletId = cash.Id },
            new { type = "Expense", amount = 1000 },
            new { type = "Expense", amount = 1000, fromWalletId = cash.Id, toWalletId = bank.Id },
            new { type = "Income", amount = 1000, fromWalletId = cash.Id, toWalletId = bank.Id },
            new { type = "Transfer", amount = 1000, fromWalletId = cash.Id, toWalletId = cash.Id },
            new { type = "Transfer", amount = 1000, fromWalletId = cash.Id, toWalletId = bank.Id, categoryId = rent },
            new { type = "Expense", amount = 1000, fromWalletId = cash.Id, categoryId = salary },
            new { type = "Expense", amount = 1000, fromWalletId = cash.Id, fee = 50 },
            new { type = "Expense", amount = 1000, fromWalletId = old.Id },
            new { type = "Expense", amount = 1000, fromWalletId = Guid.NewGuid() },
            new { type = "Expense", amount = 1000, fromWalletId = cash.Id, note = new string('x', 501) },
        ];

        foreach (var body in bad)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/transactions", body)).StatusCode);
        }

        var decimalAmount = await client.PostAsync("/api/transactions", new StringContent(
            $$"""{ "type": "Expense", "amount": 10.5, "fromWalletId": "{{cash.Id}}" }""", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, decimalAmount.StatusCode);
        Assert.Empty((await History(client)).Items);
    }

    // T-7
    [Fact]
    public async Task History_filters_and_totals_match_the_rows_shown()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 10000000 });
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank", openingBalance = 10000000 });
        var transport = await Category(client, "Expense", "Transport");
        var bus = await Category(client, "Expense", "Transport", "Bus fare");
        var cng = await Category(client, "Expense", "Transport", "Rickshaw and CNG");
        var rent = await Category(client, "Expense", "Housing", "House rent");
        var salary = await Category(client, "Income", "Salary", "Monthly salary");
        await Add(client, new { type = "Expense", amount = 6000, fromWalletId = cash.Id, categoryId = bus, occurredAt = "2026-10-31T22:00:00+06:00" });
        await Add(client, new { type = "Expense", amount = 8000, fromWalletId = cash.Id, categoryId = bus, occurredAt = "2026-11-02T08:00:00+06:00", note = "Office bus" });
        await Add(client, new { type = "Expense", amount = 12000, fromWalletId = cash.Id, categoryId = cng, occurredAt = "2026-11-03T08:00:00+06:00" });
        await Add(client, new { type = "Expense", amount = 1800000, fromWalletId = bank.Id, categoryId = rent, occurredAt = "2026-11-05T10:00:00+06:00", note = "November rent 100%" });
        await Add(client, new { type = "Income", amount = 8500000, toWalletId = bank.Id, categoryId = salary, occurredAt = "2026-11-01T10:00:00+06:00" });
        await Add(client, new { type = "Transfer", amount = 500000, fromWalletId = bank.Id, toWalletId = cash.Id, occurredAt = "2026-11-06T10:00:00+06:00" });

        var november = await History(client, "?from=2026-11-01&to=2026-11-30");
        Assert.Equal(5, november.TotalCount);
        Assert.Equal(new TotalsResult(8500000, 8000 + 12000 + 1800000), november.Totals);
        Assert.Equal("Transfer", november.Items[0].Type);

        var transportOnly = await History(client, $"?categoryId={transport}");
        Assert.Equal(3, transportOnly.TotalCount);
        Assert.Equal(26000, transportOnly.Totals.Expense);

        var cashOnly = await History(client, $"?walletId={cash.Id}&from=2026-11-01");
        Assert.Equal(3, cashOnly.TotalCount);

        Assert.Equal(1, (await History(client, "?type=Income")).TotalCount);
        Assert.Equal(1, (await History(client, "?search=office")).TotalCount);
        Assert.Equal(1, (await History(client, "?search=100%25")).TotalCount);
        Assert.Equal(0, (await History(client, "?search=%25")).TotalCount - 1);

        var paged = await History(client, "?pageSize=2&page=2");
        Assert.Equal(6, paged.TotalCount);
        Assert.Equal(2, paged.Items.Count);
        Assert.Equal(2, paged.Page);
    }

    [Fact]
    public async Task An_archived_wallet_can_stay_on_an_old_entry_but_not_be_chosen_anew()
    {
        var (client, _) = await auth.SignedInClient();
        var old = await WalletTests.Create(client, new { type = "Bank", name = "Old bank", openingBalance = 100000 });
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var expense = await Add(client, new { type = "Expense", amount = 1000, fromWalletId = old.Id });
        var other = await Add(client, new { type = "Expense", amount = 1000, fromWalletId = cash.Id });
        await client.PostAsync($"/api/wallets/{old.Id}/archive", null);

        var keep = await client.PutAsJsonAsync($"/api/transactions/{expense.Id}", new { type = "Expense", amount = 2000, fromWalletId = old.Id });
        var choose = await client.PutAsJsonAsync($"/api/transactions/{other.Id}", new { type = "Expense", amount = 1000, fromWalletId = old.Id });

        Assert.Equal(HttpStatusCode.OK, keep.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, choose.StatusCode);
    }

    // X-1
    [Fact]
    public async Task Another_account_cannot_see_change_or_use_anything()
    {
        var (owner, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(owner, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var expense = await Add(owner, new { type = "Expense", amount = 5000, fromWalletId = cash.Id });
        var theirCash = await WalletTests.Create(stranger, new { type = "Cash", name = "Cash" });
        var ownerRent = await Category(owner, "Expense", "Housing", "House rent");

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/transactions/{expense.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PutAsJsonAsync($"/api/transactions/{expense.Id}",
            new { type = "Expense", amount = 1, fromWalletId = theirCash.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/transactions/{expense.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await stranger.PostAsJsonAsync("/api/transactions",
            new { type = "Expense", amount = 1, fromWalletId = cash.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await stranger.PostAsJsonAsync("/api/transactions",
            new { type = "Expense", amount = 1, fromWalletId = theirCash.Id, categoryId = ownerRent })).StatusCode);
        Assert.Empty((await History(stranger, $"?walletId={cash.Id}")).Items);
        Assert.Equal(95000, await Balance(owner, cash.Id));
    }
}
