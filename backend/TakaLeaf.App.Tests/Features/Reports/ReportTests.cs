using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Common;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.People;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Reports;

/// <summary>Reports (P-2 to P-4). Dates are relative to today in local time.</summary>
[Collection(DatabaseCollection.Name)]
public class ReportTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    public sealed record SubResult(Guid? CategoryId, string Name, long Amount);

    public sealed record CategoryResult(Guid? CategoryId, string Name, long Amount, int Percent, List<SubResult> Children);

    public sealed record TrendResult(string Month, long Income, long Expense);

    public sealed record ReportResult(
        string Period, string Label, DateOnly From, DateOnly To, long Income, long Expense, long Saved, int? SavedPercent,
        List<CategoryResult> Spending, List<CategoryResult> Earning, List<TrendResult> Trend);

    private sealed record TotalsResult(long Income, long Expense);

    private sealed record PageResult(int TotalCount, TotalsResult Totals);

    private LocalCalendar Calendar => fixture.Factory.Services.GetRequiredService<LocalCalendar>();

    private DateOnly FirstOfMonth => new(Calendar.Today().Year, Calendar.Today().Month, 1);

    private string At(DateOnly day, int hour = 10) => Calendar.StartOf(day).AddHours(hour).ToString("O");

    // P-2, P-4
    [Fact]
    public async Task A_month_report_adds_up_and_each_total_drills_down_to_its_rows()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank", openingBalance = 10000000 });
        var bkash = await WalletTests.Create(client, new { type = "Mfs", name = "bKash", openingBalance = 1000000 });
        var housing = await TransactionTests.Category(client, "Expense", "Housing");
        var rent = await TransactionTests.Category(client, "Expense", "Housing", "House rent");
        var internet = await TransactionTests.Category(client, "Expense", "Housing", "Internet");
        var tea = await TransactionTests.Category(client, "Expense", "Food and dining", "Snacks and tea");
        var salary = await TransactionTests.Category(client, "Income", "Salary", "Monthly salary");
        var day = FirstOfMonth;
        var lastMonth = day.AddMonths(-1);

        await TransactionTests.Add(client, new { type = "Income", amount = 8500000, toWalletId = bank.Id, categoryId = salary, occurredAt = At(day) });
        await TransactionTests.Add(client, new { type = "Expense", amount = 1800000, fromWalletId = bank.Id, categoryId = rent, occurredAt = At(day) });
        await TransactionTests.Add(client, new { type = "Expense", amount = 120000, fromWalletId = bank.Id, categoryId = internet, occurredAt = At(day) });
        await TransactionTests.Add(client, new { type = "Expense", amount = 60000, fromWalletId = bkash.Id, categoryId = tea, occurredAt = At(day) });
        await TransactionTests.Add(client, new { type = "Expense", amount = 50000, fromWalletId = bkash.Id, occurredAt = At(day) });
        await TransactionTests.Add(client, new { type = "Transfer", amount = 500000, fromWalletId = bkash.Id, toWalletId = bank.Id, fee = 9250, occurredAt = At(day) });
        await TransactionTests.Add(client, new { type = "Expense", amount = 400000, fromWalletId = bank.Id, categoryId = rent, occurredAt = At(lastMonth) });
        var rafi = await PeopleTests.AddPerson(client, "Rafi");
        await client.PostAsJsonAsync($"/api/people/{rafi.Id}/loans", new { kind = "Lend", amount = 300000, walletId = bank.Id, occurredAt = At(day) });

        var report = (await client.GetFromJsonAsync<ReportResult>("/api/reports"))!;

        var expense = 1800000L + 120000 + 60000 + 50000 + 9250;
        Assert.Equal(("Month", day, day.AddMonths(1).AddDays(-1)), (report.Period, report.From, report.To));
        Assert.Equal((8500000L, expense, 8500000 - expense), (report.Income, report.Expense, report.Saved));
        Assert.Equal((int)((8500000 - expense) * 100 / 8500000), report.SavedPercent);
        Assert.Equal(report.Expense, report.Spending.Sum(c => c.Amount));
        Assert.Equal(["Housing", "Food and dining", "Uncategorised", "Fees and charges"], report.Spending.Select(c => c.Name));
        var house = report.Spending[0];
        Assert.Equal((1920000L, 1920000 * 100 / (int)expense), (house.Amount, house.Percent));
        Assert.Equal([("House rent", 1800000L), ("Internet", 120000L)], house.Children.Select(c => (c.Name, c.Amount)));
        Assert.Equal(8500000, Assert.Single(report.Earning).Amount);

        Assert.Equal(6, report.Trend.Count);
        Assert.Equal((8500000L, expense), (report.Trend[5].Income, report.Trend[5].Expense));
        Assert.Equal(400000, report.Trend[4].Expense);
        Assert.Equal(lastMonth.ToString("yyyy-MM"), report.Trend[4].Month);

        var range = $"from={report.From:yyyy-MM-dd}&to={report.To:yyyy-MM-dd}";
        var housingRows = (await client.GetFromJsonAsync<PageResult>($"/api/transactions?{range}&categoryId={housing}&type=Expense"))!;
        Assert.Equal(house.Amount, housingRows.Totals.Expense);
        var looseRows = (await client.GetFromJsonAsync<PageResult>($"/api/transactions?{range}&uncategorised=true&type=Expense"))!;
        Assert.Equal((1, 50000L), (looseRows.TotalCount, looseRows.Totals.Expense));
    }

    [Fact]
    public async Task A_year_report_has_twelve_months_and_another_account_sees_nothing()
    {
        var (client, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        var year = Calendar.Today().Year;
        await TransactionTests.Add(client, new { type = "Expense", amount = 7000, fromWalletId = cash.Id, occurredAt = At(new DateOnly(year, 3, 15)) });
        await TransactionTests.Add(client, new { type = "Expense", amount = 3000, fromWalletId = cash.Id, occurredAt = At(new DateOnly(year - 1, 12, 31), 23) });

        var report = (await client.GetFromJsonAsync<ReportResult>($"/api/reports?period=Year&year={year}"))!;
        var theirs = (await stranger.GetFromJsonAsync<ReportResult>($"/api/reports?period=Year&year={year}"))!;

        Assert.Equal(($"{year}", 7000L), (report.Label, report.Expense));
        Assert.Equal(12, report.Trend.Count);
        Assert.Equal(7000, report.Trend[2].Expense);
        Assert.Equal(0, theirs.Expense);
    }

    // P-3
    [Fact]
    public async Task An_empty_period_is_zero_without_errors_and_bad_input_is_refused()
    {
        var (client, _) = await auth.SignedInClient();

        var report = (await client.GetFromJsonAsync<ReportResult>("/api/reports?month=2026-01"))!;

        Assert.Equal((0L, 0L, 0L, (int?)null), (report.Income, report.Expense, report.Saved, report.SavedPercent));
        Assert.Empty(report.Spending);
        Assert.All(report.Trend, t => Assert.Equal(0, t.Expense));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/reports?month=Nov")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/reports?period=Year&year=99")).StatusCode);
    }
}
