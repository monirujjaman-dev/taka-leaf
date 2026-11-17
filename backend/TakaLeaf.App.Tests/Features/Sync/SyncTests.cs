using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Common;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Sync;

/// <summary>Sync push and pull (S-1 to S-12 and S-15 on the server side, X-3).</summary>
[Collection(DatabaseCollection.Name)]
public class SyncTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    public sealed record PushResultDto(Guid MutationId, string Status, string? Reason, JsonElement? Current);

    private sealed record PushResponseDto(List<PushResultDto> Results);

    public sealed record PullDto(
        long Cursor,
        bool HasMore,
        List<JsonElement> Wallets,
        List<JsonElement> Categories,
        List<JsonElement> People,
        List<JsonElement> Transactions,
        List<JsonElement> Budgets,
        List<JsonElement> RecurringRules)
    {
        public int Count => Wallets.Count + Categories.Count + People.Count + Transactions.Count + Budgets.Count + RecurringRules.Count;
    }

    private static DateTimeOffset Now => DateTimeOffset.UtcNow;

    public static object Change(string table, object row) => new { mutationId = Guid.CreateVersion7(), table, row };

    public static async Task<List<PushResultDto>> Push(HttpClient client, params object[] changes)
    {
        var response = await client.PostAsJsonAsync("/api/sync/push", new { protocol = 1, changes });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PushResponseDto>())!.Results;
    }

    public static async Task<PullDto> Pull(HttpClient client, long cursor = 0) =>
        (await client.GetFromJsonAsync<PullDto>($"/api/sync/pull?cursor={cursor}&protocol=1"))!;

    public static object Wallet(Guid id, string name, long openingBalance = 0, DateTimeOffset? updatedAt = null, DateTimeOffset? deletedAt = null, string type = "Cash", Guid? personId = null) => new
    {
        id, type, name, openingBalance, creditLimit = (long?)null, personId, icon = (string?)null, color = (string?)null,
        archived = false, excludedFromTotal = false, sortOrder = 0, updatedAt = updatedAt ?? Now, deletedAt,
    };

    public static object Expense(Guid id, Guid walletId, long amount, DateTimeOffset? updatedAt = null, DateTimeOffset? deletedAt = null) => new
    {
        id, type = "Expense", amount, fromWalletId = walletId, toWalletId = (Guid?)null, categoryId = (Guid?)null, personId = (Guid?)null,
        feeOfId = (Guid?)null, recurringRuleId = (Guid?)null, recurringDate = (DateOnly?)null, occurredAt = Now, note = (string?)null,
        updatedAt = updatedAt ?? Now, deletedAt,
    };

    private static async Task<long> Balance(HttpClient client, Guid walletId) =>
        (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{walletId}"))!.Balance;

    // S-7
    [Fact]
    public async Task A_new_phone_pulls_the_whole_account_from_cursor_zero()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 50000 });

        var first = await Pull(client);

        Assert.False(first.HasMore);
        Assert.NotEmpty(first.Categories);
        var wallet = Assert.Single(first.Wallets);
        Assert.Equal(cash.Id, wallet.GetProperty("id").GetGuid());
        Assert.Equal(50000, wallet.GetProperty("openingBalance").GetInt64());
        Assert.Equal("Cash", wallet.GetProperty("type").GetString());
        Assert.Equal(0, (await Pull(client, first.Cursor)).Count);
    }

    // S-1, S-6
    [Fact]
    public async Task Changes_made_offline_reach_the_server_and_a_delete_updates_the_balance()
    {
        var (client, _) = await auth.SignedInClient();
        var walletId = Guid.CreateVersion7();
        var ids = new[] { Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7() };

        var results = await Push(
            client,
            Change("wallets", Wallet(walletId, "bKash", 100000, type: "Mfs")),
            Change("transactions", Expense(ids[0], walletId, 1000)),
            Change("transactions", Expense(ids[1], walletId, 2000)),
            Change("transactions", Expense(ids[2], walletId, 3000)));

        Assert.All(results, r => Assert.Equal("accepted", r.Status));
        Assert.Equal(100000 - 6000, await Balance(client, walletId));

        var deleted = await Push(client, Change("transactions", Expense(ids[1], walletId, 2000, deletedAt: Now)));

        Assert.Equal("accepted", Assert.Single(deleted).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/transactions/{ids[1]}")).StatusCode);
        Assert.Equal(100000 - 4000, await Balance(client, walletId));
        var pulled = await Pull(client);
        Assert.Contains(pulled.Transactions, t => t.GetProperty("id").GetGuid() == ids[1] && t.GetProperty("deletedAt").ValueKind == JsonValueKind.String);
    }

    // S-2
    [Fact]
    public async Task A_batch_sent_twice_is_applied_once()
    {
        var (client, _) = await auth.SignedInClient();
        var walletId = Guid.CreateVersion7();
        var changes = new[] { Change("wallets", Wallet(walletId, "Cash", 10000)), Change("transactions", Expense(Guid.CreateVersion7(), walletId, 500)) };

        await Push(client, changes);
        var again = await Push(client, changes);

        Assert.All(again, r => Assert.Equal("superseded", r.Status));
        Assert.Equal(9500, await Balance(client, walletId));
    }

    // S-3
    [Fact]
    public async Task A_later_web_edit_beats_an_earlier_phone_edit()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var phoneEditedAt = Now;
        await Task.Delay(50);
        (await client.PutAsJsonAsync($"/api/wallets/{cash.Id}", new { name = "Pocket cash", openingBalance = 0 })).EnsureSuccessStatusCode();

        var result = Assert.Single(await Push(client, Change("wallets", Wallet(cash.Id, "Wallet cash", updatedAt: phoneEditedAt))));

        Assert.Equal("superseded", result.Status);
        Assert.Equal("Pocket cash", result.Current!.Value.GetProperty("name").GetString());
    }

    // S-4
    [Fact]
    public async Task A_later_phone_edit_beats_an_earlier_web_edit()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        await Task.Delay(50);

        var result = Assert.Single(await Push(client, Change("wallets", Wallet(cash.Id, "Pocket cash", 25000))));

        Assert.Equal("accepted", result.Status);
        var wallet = (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{cash.Id}"))!;
        Assert.Equal("Pocket cash", wallet.Name);
        Assert.Equal(25000, wallet.Balance);
    }

    // S-5
    [Fact]
    public async Task A_row_deleted_on_the_web_stays_deleted()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var phoneEditedAt = Now;
        (await client.DeleteAsync($"/api/wallets/{cash.Id}")).EnsureSuccessStatusCode();

        var result = Assert.Single(await Push(client, Change("wallets", Wallet(cash.Id, "Renamed", updatedAt: phoneEditedAt.AddDays(1)))));

        Assert.Equal("superseded", result.Status);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/wallets/{cash.Id}")).StatusCode);
    }

    // S-9
    [Fact]
    public async Task One_invalid_change_is_rejected_and_the_rest_are_applied()
    {
        var (client, _) = await auth.SignedInClient();
        var walletId = Guid.CreateVersion7();
        var badId = Guid.CreateVersion7();

        var results = await Push(
            client,
            Change("wallets", Wallet(walletId, "Cash", 10000)),
            Change("transactions", Expense(badId, walletId, 0)),
            Change("transactions", Expense(Guid.CreateVersion7(), walletId, 700)));

        Assert.Equal(new[] { "accepted", "rejected", "accepted" }, results.Select(r => r.Status));
        Assert.Equal("Enter an amount above zero.", results[1].Reason);
        Assert.Null(results[1].Current);
        Assert.Equal(9300, await Balance(client, walletId));
    }

    // S-10, S-8
    [Fact]
    public async Task Many_changes_go_in_batches_and_come_back_in_pages_without_gaps()
    {
        var (client, _) = await auth.SignedInClient();
        var walletId = Guid.CreateVersion7();
        await Push(client, Change("wallets", Wallet(walletId, "Cash")));
        var ids = Enumerable.Range(0, 600).Select(_ => Guid.CreateVersion7()).ToList();
        foreach (var batch in ids.Chunk(200))
        {
            var results = await Push(client, batch.Select(id => Change("transactions", Expense(id, walletId, 100))).ToArray());
            Assert.All(results, r => Assert.Equal("accepted", r.Status));
        }

        var seen = new List<Guid>();
        long cursor = 0;
        var pages = 0;
        while (true)
        {
            var page = await Pull(client, cursor);
            Assert.True(page.Cursor >= cursor);
            Assert.True(page.Count <= 500);
            seen.AddRange(page.Transactions.Select(t => t.GetProperty("id").GetGuid()));
            cursor = page.Cursor;
            pages++;
            if (!page.HasMore)
            {
                break;
            }
        }

        Assert.True(pages >= 2);
        Assert.Equal(ids.Order(), seen.Order());
        Assert.Equal(-60000, await Balance(client, walletId));
    }

    // S-11
    [Fact]
    public async Task A_phone_clock_days_ahead_does_not_win_later_edits()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });

        var result = Assert.Single(await Push(client, Change("wallets", Wallet(cash.Id, "From the phone", updatedAt: Now.AddDays(2)))));

        Assert.Equal("accepted", result.Status);
        Assert.True(result.Current!.Value.GetProperty("updatedAt").GetDateTimeOffset() < Now.AddMinutes(1));
        (await client.PutAsJsonAsync($"/api/wallets/{cash.Id}", new { name = "From the web", openingBalance = 0 })).EnsureSuccessStatusCode();
        var stale = Assert.Single(await Push(client, Change("wallets", Wallet(cash.Id, "Old phone edit", updatedAt: Now.AddMinutes(-1)))));
        Assert.Equal("superseded", stale.Status);
    }

    // S-15
    [Fact]
    public async Task A_recurring_date_recorded_on_both_sides_is_kept_once()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var today = fixture.Factory.Services.GetRequiredService<LocalCalendar>().Today();
        var created = await client.PostAsJsonAsync("/api/recurring", new { type = "Expense", amount = 5000, fromWalletId = cash.Id, frequency = "Monthly", startDate = today });
        var ruleId = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync($"/api/recurring/{ruleId}/record", new { })).StatusCode);

        var phoneCopy = new
        {
            id = Guid.CreateVersion7(), type = "Expense", amount = 5000L, fromWalletId = cash.Id, toWalletId = (Guid?)null, categoryId = (Guid?)null,
            personId = (Guid?)null, feeOfId = (Guid?)null, recurringRuleId = ruleId, recurringDate = today, occurredAt = Now, note = (string?)null,
            updatedAt = Now, deletedAt = (DateTimeOffset?)null,
        };
        var result = Assert.Single(await Push(client, Change("transactions", phoneCopy)));

        Assert.Equal("superseded", result.Status);
        Assert.Null(result.Current);
        Assert.Equal(95000, await Balance(client, cash.Id));
    }

    [Fact]
    public async Task Loans_and_transfer_fees_sync_as_their_own_rows()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = Guid.CreateVersion7();
        var bkash = Guid.CreateVersion7();
        var person = Guid.CreateVersion7();
        var lent = Guid.CreateVersion7();
        var borrowed = Guid.CreateVersion7();
        var transfer = Guid.CreateVersion7();
        object Transfer(Guid id, Guid from, Guid to, long amount, Guid? personId = null, Guid? feeOf = null, string type = "Transfer") => new
        {
            id, type, amount, fromWalletId = from, toWalletId = type == "Transfer" ? to : (Guid?)null, categoryId = (Guid?)null, personId,
            feeOfId = feeOf, recurringRuleId = (Guid?)null, recurringDate = (DateOnly?)null, occurredAt = Now, note = (string?)null,
            updatedAt = Now, deletedAt = (DateTimeOffset?)null,
        };

        var results = await Push(
            client,
            Change("wallets", Wallet(cash, "Cash", 100000)),
            Change("wallets", Wallet(bkash, "bKash", 0, type: "Mfs")),
            Change("people", new { id = person, name = "Rahim", note = (string?)null, updatedAt = Now, deletedAt = (DateTimeOffset?)null }),
            Change("wallets", Wallet(lent, "Lent to Rahim", type: "Lent", personId: person)),
            Change("wallets", Wallet(borrowed, "Borrowed from Rahim", type: "Borrowed", personId: person)),
            Change("transactions", Transfer(Guid.CreateVersion7(), cash, lent, 20000, person)),
            Change("transactions", Transfer(transfer, cash, bkash, 30000)),
            Change("transactions", Transfer(Guid.CreateVersion7(), cash, cash, 500, feeOf: transfer, type: "Expense")));

        Assert.All(results, r => Assert.True(r.Status == "accepted", r.Reason));
        var people = await client.GetFromJsonAsync<JsonElement>("/api/people");
        Assert.Equal(20000, people.GetProperty("owedToMe").GetInt64());
        var shown = await client.GetFromJsonAsync<TransactionTests.TransactionResult>($"/api/transactions/{transfer}");
        Assert.Equal(500, shown!.Fee);
        Assert.Equal(100000 - 20000 - 30000 - 500, await Balance(client, cash));
        Assert.Equal(30000, await Balance(client, bkash));

        var loanOnOwnWallets = await Push(client, Change("transactions", Transfer(Guid.CreateVersion7(), cash, bkash, 100, person)));
        Assert.Equal("rejected", Assert.Single(loanOnOwnWallets).Status);
    }

    // X-3
    [Fact]
    public async Task Another_account_cannot_change_rows_through_sync()
    {
        var (owner, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(owner, new { type = "Cash", name = "Cash", openingBalance = 1000 });

        var result = Assert.Single(await Push(stranger, Change("wallets", Wallet(cash.Id, "Mine now", 999999, Now.AddMinutes(1)))));

        Assert.Equal("rejected", result.Status);
        Assert.Null(result.Current);
        Assert.Equal("Cash", (await owner.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{cash.Id}"))!.Name);
        Assert.Empty((await Pull(stranger)).Wallets);
    }

    // S-16
    [Fact]
    public async Task An_old_app_is_told_to_update()
    {
        var (client, _) = await auth.SignedInClient();

        Assert.Equal(HttpStatusCode.UpgradeRequired, (await client.GetAsync("/api/sync/pull?cursor=0&protocol=0")).StatusCode);
        Assert.Equal(HttpStatusCode.UpgradeRequired, (await client.PostAsJsonAsync("/api/sync/push", new { protocol = 0, changes = Array.Empty<object>() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/sync/pull?cursor=0")).StatusCode);
    }

    [Fact]
    public async Task Sync_needs_a_signed_in_user()
    {
        var client = auth.NewClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/sync/pull?cursor=0&protocol=1")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/sync/push", new { protocol = 1 })).StatusCode);
    }
}
