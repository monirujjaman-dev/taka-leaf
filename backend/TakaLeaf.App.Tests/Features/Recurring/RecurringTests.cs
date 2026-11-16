using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Common;
using TakaLeaf.App.Features.Recurring;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Recurring;

/// <summary>Recurring transactions (R-1 to R-7). Dates are relative to today in local time.</summary>
[Collection(DatabaseCollection.Name)]
public class RecurringTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private sealed record RuleResult(
        Guid Id, string Type, long Amount, Guid? FromWalletId, string? FromWalletName, Guid? ToWalletId, string? ToWalletName,
        Guid? CategoryId, string? CategoryName, string? Note, string Frequency, int Interval, DateOnly StartDate, DateOnly? EndDate,
        DateOnly? NextDate, int DueCount, bool AutoRecord, bool Paused);

    private sealed record RecordedResult(Guid Id, string Type, long Amount, DateTimeOffset OccurredAt, Guid? RecurringRuleId, string? CategoryName);

    private DateOnly Today => fixture.Factory.Services.GetRequiredService<LocalCalendar>().Today();

    private DateTimeOffset NineAm(DateOnly day) => fixture.Factory.Services.GetRequiredService<LocalCalendar>().StartOf(day).AddHours(9);

    private static async Task<RuleResult> Create(HttpClient client, object body)
    {
        var response = await client.PostAsJsonAsync("/api/recurring", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<RuleResult>())!;
    }

    private static async Task<RuleResult> Get(HttpClient client, Guid id) => (await client.GetFromJsonAsync<RuleResult>($"/api/recurring/{id}"))!;

    private static async Task<List<RuleResult>> Due(HttpClient client) => (await client.GetFromJsonAsync<List<RuleResult>>("/api/recurring/due"))!;

    private async Task<int> RunWorker()
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<RecurringRecorder>().RecordAutomaticAsync(CancellationToken.None);
    }

    // R-1
    [Fact]
    public async Task A_manual_rule_waits_to_be_recorded_or_skipped_date_by_date()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank", openingBalance = 10000000 });
        var rent = await TransactionTests.Category(client, "Expense", "Housing", "House rent");
        var start = Today.AddMonths(-2);
        var rule = await Create(client, new { type = "Expense", amount = 1800000, fromWalletId = bank.Id, categoryId = rent, note = "Rent", frequency = "Monthly", startDate = start });

        var due = Assert.Single(await Due(client));
        Assert.Equal((start, 3), (due.NextDate!.Value, due.DueCount));

        var recorded = await client.PostAsJsonAsync($"/api/recurring/{rule.Id}/record", new { amount = 1850000 });
        Assert.Equal(HttpStatusCode.Created, recorded.StatusCode);
        var transaction = (await recorded.Content.ReadFromJsonAsync<RecordedResult>())!;
        Assert.Equal((1850000L, rule.Id, "House rent"), (transaction.Amount, transaction.RecurringRuleId, transaction.CategoryName));
        Assert.Equal(NineAm(start), transaction.OccurredAt);
        Assert.Equal(start.AddMonths(1), (await Get(client, rule.Id)).NextDate);

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/recurring/{rule.Id}/skip", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync($"/api/recurring/{rule.Id}/record", new { })).StatusCode);

        Assert.Empty(await Due(client));
        Assert.Equal(Today.AddMonths(1), (await Get(client, rule.Id)).NextDate);
        Assert.Equal(10000000 - 1850000 - 1800000, (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{bank.Id}"))!.Balance);
    }

    // R-2
    [Fact]
    public async Task Automatic_rules_are_recorded_once_per_date_even_from_an_archived_wallet()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var rule = await Create(client, new { type = "Expense", amount = 5000, fromWalletId = cash.Id, frequency = "Daily", startDate = Today.AddDays(-2), autoRecord = true });
        await client.PostAsync($"/api/wallets/{cash.Id}/archive", null);

        await RunWorker();
        await RunWorker();

        Assert.Equal(100000 - 3 * 5000, (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{cash.Id}"))!.Balance);
        Assert.Equal(Today.AddDays(1), (await Get(client, rule.Id)).NextDate);
        Assert.Empty(await Due(client));
    }

    // R-3
    [Fact]
    public async Task A_rule_with_a_last_date_ends()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var rule = await Create(client, new
        {
            type = "Expense", amount = 1000, fromWalletId = cash.Id, frequency = "Weekly",
            startDate = Today.AddDays(-10), endDate = Today.AddDays(-3), autoRecord = true,
        });

        await RunWorker();

        var ended = await Get(client, rule.Id);
        Assert.Null(ended.NextDate);
        Assert.Equal(0, ended.DueCount);
        Assert.Equal(98000, (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{cash.Id}"))!.Balance);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/recurring/{rule.Id}/record", new { })).StatusCode);
    }

    // R-4
    [Fact]
    public async Task Monthly_on_the_31st_falls_on_the_last_day_of_shorter_months()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var rule = await Create(client, new { type = "Income", amount = 1000, toWalletId = cash.Id, frequency = "Monthly", startDate = new DateOnly(2027, 1, 31) });

        await client.PostAsync($"/api/recurring/{rule.Id}/skip", null);
        Assert.Equal(new DateOnly(2027, 2, 28), (await Get(client, rule.Id)).NextDate);
        await client.PostAsync($"/api/recurring/{rule.Id}/skip", null);
        Assert.Equal(new DateOnly(2027, 3, 31), (await Get(client, rule.Id)).NextDate);
    }

    // R-5
    [Fact]
    public async Task Changing_the_schedule_does_not_bring_back_dates_already_handled()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var start = Today.AddMonths(-2);
        var rule = await Create(client, new { type = "Income", amount = 1000, toWalletId = cash.Id, frequency = "Monthly", startDate = start });
        await client.PostAsync($"/api/recurring/{rule.Id}/skip", null);
        var reached = start.AddMonths(1);

        var changed = await client.PutAsJsonAsync($"/api/recurring/{rule.Id}", new { type = "Income", amount = 2000, toWalletId = cash.Id, frequency = "Weekly", startDate = start });

        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var next = (await changed.Content.ReadFromJsonAsync<RuleResult>())!.NextDate!.Value;
        Assert.True(next >= reached && next < reached.AddDays(7));
        Assert.Equal(0, (next.DayNumber - start.DayNumber) % 7);
    }

    // R-6
    [Fact]
    public async Task Invalid_rules_are_refused_and_paused_rules_are_not_due()
    {
        var (client, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash" });
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank" });
        var rent = await TransactionTests.Category(client, "Expense", "Housing", "House rent");
        var theirs = await WalletTests.Create(stranger, new { type = "Cash", name = "Cash" });

        object[] bad =
        [
            new { type = "Expense", amount = 1000, fromWalletId = cash.Id, startDate = Today },
            new { type = "Expense", amount = 1000, fromWalletId = cash.Id, frequency = "Monthly" },
            new { type = "Expense", amount = 1000, fromWalletId = cash.Id, frequency = "Monthly", interval = 0, startDate = Today },
            new { type = "Expense", amount = 1000, fromWalletId = cash.Id, frequency = "Monthly", startDate = Today, endDate = Today.AddDays(-1) },
            new { type = "Transfer", amount = 1000, fromWalletId = cash.Id, toWalletId = bank.Id, categoryId = rent, frequency = "Monthly", startDate = Today },
            new { type = "Expense", amount = 0, fromWalletId = cash.Id, frequency = "Monthly", startDate = Today },
            new { type = "Expense", amount = 1000, fromWalletId = theirs.Id, frequency = "Monthly", startDate = Today },
        ];
        foreach (var body in bad)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/recurring", body)).StatusCode);
        }

        var rule = await Create(client, new { type = "Transfer", amount = 1000, fromWalletId = bank.Id, toWalletId = cash.Id, frequency = "Weekly", interval = 2, startDate = Today });
        Assert.Single(await Due(client));
        await client.PostAsync($"/api/recurring/{rule.Id}/pause", null);
        Assert.Empty(await Due(client));
        await client.PostAsync($"/api/recurring/{rule.Id}/resume", null);
        Assert.Single(await Due(client));
    }

    // R-7
    [Fact]
    public async Task Another_account_cannot_see_or_record_a_rule_and_deleting_keeps_history()
    {
        var (owner, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(owner, new { type = "Cash", name = "Cash", openingBalance = 10000 });
        var rule = await Create(owner, new { type = "Expense", amount = 1000, fromWalletId = cash.Id, frequency = "Monthly", startDate = Today });

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/recurring/{rule.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync($"/api/recurring/{rule.Id}/record", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/recurring/{rule.Id}")).StatusCode);

        await owner.PostAsJsonAsync($"/api/recurring/{rule.Id}/record", new { });
        Assert.Equal(HttpStatusCode.NoContent, (await owner.DeleteAsync($"/api/recurring/{rule.Id}")).StatusCode);
        Assert.Empty((await owner.GetFromJsonAsync<List<RuleResult>>("/api/recurring"))!);
        Assert.Equal(9000, (await owner.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{cash.Id}"))!.Balance);
    }
}
