using System.Net;
using System.Net.Http.Json;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.People;

/// <summary>People, and money lent, borrowed and paid back (L-1 to L-6).</summary>
[Collection(DatabaseCollection.Name)]
public class PeopleTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    public sealed record PersonResult(Guid Id, string Name, string? Note, long OwesMe, long IOwe, long Net, DateTimeOffset? LastLoanAt);

    public sealed record LoanResult(Guid Id, string Kind, long Amount, Guid WalletId, string? WalletName, DateTimeOffset OccurredAt, string? Note);

    private sealed record DetailResult(PersonResult Person, List<LoanResult> Loans);

    private sealed record ListResult(List<PersonResult> People, long OwedToMe, long IOwe);

    private sealed record DashboardResult(long NetBalance, long Assets, long Liabilities, long OwedToMe, long IOwe);

    public static async Task<PersonResult> AddPerson(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/people", new { name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PersonResult>())!;
    }

    private static async Task<LoanResult> Loan(HttpClient client, Guid personId, string kind, long amount, Guid walletId, string? note = null)
    {
        var response = await client.PostAsJsonAsync($"/api/people/{personId}/loans", new { kind, amount, walletId, note });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<LoanResult>())!;
    }

    private static async Task<DetailResult> Detail(HttpClient client, Guid personId) =>
        (await client.GetFromJsonAsync<DetailResult>($"/api/people/{personId}"))!;

    private static async Task<long> Balance(HttpClient client, Guid walletId) =>
        (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{walletId}"))!.Balance;

    // L-1
    [Fact]
    public async Task Lending_moves_money_out_of_the_wallet_and_shows_what_is_owed()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 1000000 });
        var rafi = await AddPerson(client, "Rafi");

        var loan = await Loan(client, rafi.Id, "Lend", 500000, cash.Id, "For his bike repair");

        Assert.Equal("Lend", loan.Kind);
        Assert.Equal("Cash", loan.WalletName);
        Assert.Equal(500000, await Balance(client, cash.Id));
        var detail = await Detail(client, rafi.Id);
        Assert.Equal(500000, detail.Person.OwesMe);
        Assert.Equal(500000, detail.Person.Net);
        var dashboard = (await client.GetFromJsonAsync<DashboardResult>("/api/dashboard"))!;
        Assert.Equal(500000, dashboard.OwedToMe);
        Assert.Equal(1000000, dashboard.NetBalance);
    }

    // L-2
    [Fact]
    public async Task Being_paid_back_in_parts_brings_the_balance_down_and_not_past_zero()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 1000000 });
        var bkash = await WalletTests.Create(client, new { type = "Mfs", name = "bKash" });
        var rafi = await AddPerson(client, "Rafi");
        await Loan(client, rafi.Id, "Lend", 500000, cash.Id);

        await Loan(client, rafi.Id, "GotBack", 200000, bkash.Id);
        var tooMuch = await client.PostAsJsonAsync($"/api/people/{rafi.Id}/loans", new { kind = "GotBack", amount = 300001, walletId = bkash.Id });

        Assert.Equal(HttpStatusCode.BadRequest, tooMuch.StatusCode);
        Assert.Contains("৳3,000.00", await tooMuch.Content.ReadAsStringAsync());
        Assert.Equal(200000, await Balance(client, bkash.Id));
        Assert.Equal(300000, (await Detail(client, rafi.Id)).Person.OwesMe);
    }

    // L-3
    [Fact]
    public async Task Borrowing_and_paying_back_track_what_the_user_owes()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var uncle = await AddPerson(client, "Uncle");

        await Loan(client, uncle.Id, "Borrow", 2000000, cash.Id);
        Assert.Equal(2000000, await Balance(client, cash.Id));
        Assert.Equal(2000000, (await Detail(client, uncle.Id)).Person.IOwe);
        var dashboard = (await client.GetFromJsonAsync<DashboardResult>("/api/dashboard"))!;
        Assert.Equal(2000000, dashboard.IOwe);
        Assert.Equal(0, dashboard.NetBalance);

        await Loan(client, uncle.Id, "PaidBack", 2000000, cash.Id);
        var settled = (await Detail(client, uncle.Id)).Person;
        Assert.Equal((0L, 0L, 0L), (settled.OwesMe, settled.IOwe, settled.Net));
    }

    // L-4
    [Fact]
    public async Task Editing_a_repayment_checks_against_the_debt_without_counting_itself()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 1000000 });
        var rafi = await AddPerson(client, "Rafi");
        await Loan(client, rafi.Id, "Lend", 500000, cash.Id);
        var back = await Loan(client, rafi.Id, "GotBack", 500000, cash.Id);

        var same = await client.PutAsJsonAsync($"/api/people/{rafi.Id}/loans/{back.Id}", new { kind = "GotBack", amount = 400000, walletId = cash.Id });
        var more = await client.PutAsJsonAsync($"/api/people/{rafi.Id}/loans/{back.Id}", new { kind = "GotBack", amount = 500001, walletId = cash.Id });

        Assert.Equal(HttpStatusCode.OK, same.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, more.StatusCode);
        Assert.Equal(100000, (await Detail(client, rafi.Id)).Person.OwesMe);
        Assert.Equal(900000, await Balance(client, cash.Id));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/people/{rafi.Id}/loans/{back.Id}")).StatusCode);
        Assert.Equal(500000, (await Detail(client, rafi.Id)).Person.OwesMe);
    }

    // L-5
    [Fact]
    public async Task Loans_show_in_history_but_are_changed_only_from_people()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 1000000 });
        var rafi = await AddPerson(client, "Rafi");
        var loan = await Loan(client, rafi.Id, "Lend", 500000, cash.Id);
        var lentWallet = (await client.GetFromJsonAsync<WalletListResult>("/api/wallets"))!.Wallets.Single(w => w.Name == "Lent to Rafi");

        var row = await client.GetFromJsonAsync<TransactionTests.TransactionResult>($"/api/transactions/{loan.Id}");
        Assert.Equal(rafi.Id, row!.PersonId);
        Assert.Equal("Lent to Rafi", row.ToWalletName);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync($"/api/transactions/{loan.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/transactions",
            new { type = "Transfer", amount = 100, fromWalletId = cash.Id, toWalletId = lentWallet.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/people/{rafi.Id}/loans",
            new { kind = "Lend", amount = 100, walletId = lentWallet.Id })).StatusCode);
    }

    private sealed record WalletListResult(List<WalletTests.WalletResult> Wallets);

    // L-6
    [Fact]
    public async Task People_are_listed_named_uniquely_renamed_and_deleted_only_without_loans()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 1000000 });
        var rafi = await AddPerson(client, "Rafi");
        var sister = await AddPerson(client, "Nusrat");
        await Loan(client, rafi.Id, "Lend", 100000, cash.Id);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/people", new { name = " rafi " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/people", new { name = "" })).StatusCode);

        var list = (await client.GetFromJsonAsync<ListResult>("/api/people"))!;
        Assert.Equal(["Rafi", "Nusrat"], list.People.Select(p => p.Name));
        Assert.Equal(100000, list.OwedToMe);

        var renamed = await client.PutAsJsonAsync($"/api/people/{rafi.Id}", new { name = "Rafi bhai", note = "Office" });
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        var wallets = (await client.GetFromJsonAsync<WalletListResult>("/api/wallets"))!.Wallets;
        Assert.Contains(wallets, w => w.Name == "Lent to Rafi bhai");

        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/people/{rafi.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/people/{sister.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/people/{sister.Id}")).StatusCode);
        Assert.DoesNotContain((await client.GetFromJsonAsync<WalletListResult>("/api/wallets"))!.Wallets, w => w.Name.Contains("Nusrat"));
    }

    [Fact]
    public async Task Another_account_cannot_see_or_use_a_person()
    {
        var (owner, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(owner, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var theirCash = await WalletTests.Create(stranger, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var rafi = await AddPerson(owner, "Rafi");
        var loan = await Loan(owner, rafi.Id, "Lend", 1000, cash.Id);

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/people/{rafi.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync($"/api/people/{rafi.Id}/loans",
            new { kind = "Lend", amount = 1, walletId = theirCash.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/people/{rafi.Id}/loans/{loan.Id}")).StatusCode);
        var mine = await AddPerson(stranger, "Rafi");
        Assert.Equal(HttpStatusCode.BadRequest, (await stranger.PostAsJsonAsync($"/api/people/{mine.Id}/loans",
            new { kind = "Lend", amount = 1, walletId = cash.Id })).StatusCode);
        Assert.DoesNotContain((await stranger.GetFromJsonAsync<ListResult>("/api/people"))!.People, p => p.OwesMe > 0);
    }
}
