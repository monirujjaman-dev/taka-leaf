using System.Net;
using System.Net.Http.Json;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Dashboard;

/// <summary>Test cases P-1 and P-3, and fixture F-9.</summary>
[Collection(DatabaseCollection.Name)]
public class DashboardTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private sealed record SpendingResult(Guid? CategoryId, string Name, long Amount);

    private sealed record DashboardResult(
        string Month, long NetBalance, long Assets, long Liabilities, long Income, long Expense, long OwedToMe, long IOwe,
        List<SpendingResult> SpendingByCategory, List<TransactionTests.TransactionResult> Recent);

    private static async Task<DashboardResult> Get(HttpClient client, string month) =>
        (await client.GetFromJsonAsync<DashboardResult>($"/api/dashboard?month={month}"))!;

    // P-1
    [Fact]
    public async Task The_dashboard_adds_up_for_a_month()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank", openingBalance = 2000000 });
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var card = await WalletTests.Create(client, new { type = "CreditCard", name = "Card", creditLimit = 10000000 });
        var salary = await TransactionTests.Category(client, "Income", "Salary", "Monthly salary");
        var rent = await TransactionTests.Category(client, "Expense", "Housing", "House rent");
        var internet = await TransactionTests.Category(client, "Expense", "Housing", "Internet");
        var ai = await TransactionTests.Category(client, "Expense", "Learning tools", "AI subscriptions");
        await TransactionTests.Add(client, new { type = "Income", amount = 8500000, toWalletId = bank.Id, categoryId = salary, occurredAt = "2026-11-01T10:00:00+06:00" });
        await TransactionTests.Add(client, new { type = "Expense", amount = 1800000, fromWalletId = bank.Id, categoryId = rent, occurredAt = "2026-11-05T10:00:00+06:00" });
        await TransactionTests.Add(client, new { type = "Expense", amount = 120000, fromWalletId = bank.Id, categoryId = internet, occurredAt = "2026-11-06T10:00:00+06:00" });
        await TransactionTests.Add(client, new { type = "Expense", amount = 240000, fromWalletId = card.Id, categoryId = ai, occurredAt = "2026-11-03T10:00:00+06:00" });
        await TransactionTests.Add(client, new { type = "Expense", amount = 5000, fromWalletId = cash.Id, occurredAt = "2026-11-07T10:00:00+06:00" });
        await TransactionTests.Add(client, new { type = "Transfer", amount = 300000, fromWalletId = bank.Id, toWalletId = cash.Id, fee = 0, occurredAt = "2026-11-08T10:00:00+06:00" });
        await TransactionTests.Add(client, new { type = "Expense", amount = 70000, fromWalletId = cash.Id, categoryId = rent, occurredAt = "2026-10-20T10:00:00+06:00" });

        var dashboard = await Get(client, "2026-11");

        Assert.Equal("2026-11", dashboard.Month);
        Assert.Equal(8500000, dashboard.Income);
        Assert.Equal(1800000 + 120000 + 240000 + 5000, dashboard.Expense);
        var bankBalance = 2000000 + 8500000 - 1800000 - 120000 - 300000;
        var cashBalance = 100000 - 5000 + 300000 - 70000;
        Assert.Equal(bankBalance + cashBalance, dashboard.Assets);
        Assert.Equal(240000, dashboard.Liabilities);
        Assert.Equal(bankBalance + cashBalance - 240000, dashboard.NetBalance);
        Assert.Equal(
            [("Housing", 1920000L), ("Learning tools", 240000L), ("Uncategorised", 5000L)],
            dashboard.SpendingByCategory.Select(s => (s.Name, s.Amount)));
        Assert.Equal(dashboard.Expense, dashboard.SpendingByCategory.Sum(s => s.Amount));
        Assert.Equal(5, dashboard.Recent.Count);
        Assert.Equal("Transfer", dashboard.Recent[0].Type);
    }

    // F-9
    [Fact]
    public async Task A_late_night_entry_counts_in_the_local_month()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        await TransactionTests.Add(client, new { type = "Expense", amount = 3000, fromWalletId = cash.Id, occurredAt = "2026-11-30T23:30:00+06:00" });

        Assert.Equal(3000, (await Get(client, "2026-11")).Expense);
        Assert.Equal(0, (await Get(client, "2026-12")).Expense);
    }

    // P-3
    [Fact]
    public async Task An_empty_month_is_all_zero_without_errors()
    {
        var (client, _) = await auth.SignedInClient();

        var dashboard = await Get(client, "2026-01");

        Assert.Equal(0, dashboard.Income);
        Assert.Equal(0, dashboard.Expense);
        Assert.Equal(0, dashboard.NetBalance);
        Assert.Empty(dashboard.SpendingByCategory);
        Assert.Empty(dashboard.Recent);
    }

    [Fact]
    public async Task A_wrong_month_is_refused_and_no_month_means_this_one()
    {
        var (client, _) = await auth.SignedInClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/dashboard?month=November")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/dashboard")).StatusCode);
    }
}
