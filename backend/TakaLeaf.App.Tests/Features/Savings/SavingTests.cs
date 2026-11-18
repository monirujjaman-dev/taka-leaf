using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Common;
using TakaLeaf.App.Features.Savings;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Sync;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Savings;

[Collection(DatabaseCollection.Name)]
public class SavingTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    public sealed record Next(int? Number, DateOnly Date, string Label, long? Amount, string Action, bool Overdue);

    public sealed record SavingResult(
        Guid Id, string Kind, string Name, string? Provider, Guid? WalletId, Guid PayFromWalletId, string? PayFromWalletName, long Amount,
        int RatePoints, int Months, int EveryMonths, DateOnly StartDate, int TaxPoints, long ChargesPerYear, long? MaturityAmount, long? Cover,
        string? Policy, string? PolicyNumber, string? Insured, string? Nominee, List<string> BondNumbers, int PaidBefore, bool AutoRecord,
        bool Remind, bool Renew, List<int> Missed, DateOnly? ClosedOn, long Balance, bool Closed, DateOnly? MaturesOn, int Done, int? Total,
        Next? Next, long ProfitReceived, long TaxTaken, long PaidSoFar, long? Estimate, int DaysDone, int DaysTotal, int BondCount,
        int BondsInDraw, DateOnly? NextDraw, DateOnly? GraceEnds);

    private sealed record TaxYear(DateOnly From, DateOnly To, long Invested, long Profit, long Tax);

    private sealed record Summary(long Saved, long Deposits, long Certificates, long PrizeBonds, long Cover, int Policies, TaxYear TaxYear, string? NextToMature);

    private sealed record ListResult(Summary Summary, List<JsonElement> ComingUp, List<SavingResult> Savings);

    private sealed record ScheduleRow(int Number, DateOnly Date, string Status, long Amount, long Tax);

    private sealed record Detail(SavingResult Saving, List<ScheduleRow> Schedule, List<TransactionTests.TransactionResult> Activity);

    private DateOnly Today => fixture.Factory.Services.GetRequiredService<LocalCalendar>().Today();

    public static async Task<SavingResult> Add(HttpClient client, object body)
    {
        var response = await client.PostAsJsonAsync("/api/savings", body);
        Assert.True(response.StatusCode == HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<SavingResult>())!;
    }

    private static async Task<SavingResult> Act(HttpClient client, Guid id, string action, object body)
    {
        var response = await client.PostAsJsonAsync($"/api/savings/{id}/{action}", body);
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<SavingResult>())!;
    }

    private static async Task<Detail> Get(HttpClient client, Guid id) => (await client.GetFromJsonAsync<Detail>($"/api/savings/{id}"))!;

    private static async Task<long> Balance(HttpClient client, Guid walletId) =>
        (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{walletId}"))!.Balance;

    private async Task<int> RunRecorder()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SavingRecorder>().RecordDueAsync(CancellationToken.None);
    }

    private async Task<(HttpClient Client, Guid Bank)> Account()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "City Bank account", openingBalance = 100_000_000 });
        return (client, bank.Id);
    }

    /// <summary>৳5,00,000 for 12 months at 9.75 %, 10 % tax, ৳3,000 excise duty.</summary>
    private static object Fdr(Guid bank, DateOnly start, bool held = false, bool renew = true) => new
    {
        kind = "Fdr", name = "City Bank FDR", provider = "City Bank", payFromWalletId = bank, fromWalletId = held ? (Guid?)null : bank, alreadyHeld = held,
        amount = 50_000_000, ratePoints = 975, months = 12, everyMonths = 0, startDate = start, taxPoints = 1000, chargesPerYear = 300_000, renew,
    };

    [Fact]
    public async Task A_new_FDR_moves_the_money_and_shows_what_it_pays_at_maturity()
    {
        var (client, bank) = await Account();

        var fdr = await Add(client, Fdr(bank, Today));

        Assert.Equal(50_000_000, fdr.Balance);
        Assert.Equal(50_000_000 + 4_875_000 - 487_500 - 300_000, fdr.Estimate);
        Assert.Equal(Today.AddMonths(12), fdr.MaturesOn);
        Assert.Equal("Renews", fdr.Next!.Label);
        Assert.Equal("Auto", fdr.Next.Action);
        Assert.Equal(50_000_000, await Balance(client, bank));
        Assert.Equal(50_000_000, await Balance(client, fdr.WalletId!.Value));

        var list = (await client.GetFromJsonAsync<ListResult>("/api/savings"))!;
        Assert.Equal(50_000_000, list.Summary.Saved);
        Assert.Equal(50_000_000, list.Summary.Deposits);
        Assert.Equal(50_000_000, list.Summary.TaxYear.Invested);
        Assert.Equal("City Bank FDR", list.Summary.NextToMature);

        var wallets = await client.GetFromJsonAsync<JsonElement>("/api/wallets");
        Assert.Equal(100_000_000, wallets.GetProperty("totals").GetProperty("assets").GetInt64());
    }

    [Fact]
    public async Task An_FDR_renews_at_maturity_with_its_profit_after_tax_and_duty()
    {
        var (client, bank) = await Account();
        var fdr = await Add(client, Fdr(bank, Today.AddMonths(-12), held: true));

        Assert.Equal(1, await RunRecorder());

        var detail = await Get(client, fdr.Id);
        Assert.Equal(54_087_500, detail.Saving.Amount);
        Assert.Equal(54_087_500, detail.Saving.Balance);
        Assert.Equal(Today, detail.Saving.StartDate);
        Assert.False(detail.Saving.Closed);
        Assert.Contains(detail.Activity, t => t.CategoryName == "Profit on savings" && t.Amount == 4_875_000);
        Assert.Contains(detail.Activity, t => t.CategoryName == "Tax at source" && t.Amount == 487_500);
        Assert.Contains(detail.Activity, t => t.Note == "Excise duty" && t.Amount == 300_000);
        Assert.Equal(100_000_000, await Balance(client, bank));
        Assert.Equal(0, await RunRecorder());
    }

    [Fact]
    public async Task An_FDR_that_does_not_renew_pays_into_the_account_and_closes()
    {
        var (client, bank) = await Account();
        var fdr = await Add(client, Fdr(bank, Today.AddMonths(-12), held: true, renew: false));

        await RunRecorder();

        var detail = await Get(client, fdr.Id);
        Assert.True(detail.Saving.Closed);
        Assert.Equal(0, detail.Saving.Balance);
        Assert.Equal(100_000_000 + 54_087_500, await Balance(client, bank));
    }

    [Fact]
    public async Task A_DPS_takes_instalments_marks_missed_ones_and_undoes_the_last()
    {
        var (client, bank) = await Account();
        var dps = await Add(client, new
        {
            kind = "Dps", name = "BRAC Bank DPS", payFromWalletId = bank, amount = 500_000, ratePoints = 900, months = 60, startDate = Today, autoRecord = false,
        });
        Assert.Equal(SavingMath.DpsMaturity(500_000, 900, 60), dps.Estimate);
        Assert.Equal(37_994_908, dps.Estimate);
        Assert.Equal(new Next(1, Today, "Instalment 1", 500_000, "Record", false), dps.Next);

        var paid = await Act(client, dps.Id, "deposit", new { });
        Assert.Equal(500_000, paid.Balance);
        Assert.Equal(1, paid.Done);
        Assert.Equal(100_000_000 - 500_000, await Balance(client, bank));

        var skipped = await Act(client, dps.Id, "skip", new { });
        Assert.Equal(new[] { 2 }, skipped.Missed);
        Assert.Equal(3, skipped.Next!.Number);
        Assert.Equal(SavingMath.DpsMaturity(500_000, 900, 59), skipped.Estimate);

        var schedule = (await Get(client, dps.Id)).Schedule;
        Assert.Equal(new[] { "Paid", "Missed", "Due", "Upcoming" }, schedule.Take(4).Select(r => r.Status));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/savings/{dps.Id}/last")).StatusCode);
        Assert.Equal(0, (await Get(client, dps.Id)).Saving.Balance);
    }

    [Fact]
    public async Task An_automatic_DPS_records_the_instalments_that_fell_due()
    {
        var (client, bank) = await Account();
        var dps = await Add(client, new
        {
            kind = "Dps", name = "DPS", payFromWalletId = bank, amount = 500_000, ratePoints = 900, months = 60, startDate = Today.AddMonths(-2), autoRecord = true,
        });

        Assert.Equal(3, await RunRecorder());

        var detail = await Get(client, dps.Id);
        Assert.Equal(1_500_000, detail.Saving.Balance);
        Assert.Equal(4, detail.Saving.Next!.Number);
        Assert.Equal("Auto", detail.Saving.Next.Action);
    }

    [Fact]
    public async Task A_certificate_pays_profit_after_tax_at_source_and_can_be_encashed_early()
    {
        var (client, bank) = await Account();
        var cert = await Add(client, new
        {
            kind = "Certificate", name = "3-month profit Sanchayapatra", payFromWalletId = bank, alreadyHeld = true, amount = 50_000_000, ratePoints = 1104,
            months = 36, everyMonths = 3, startDate = Today.AddMonths(-6), paidBefore = 1,
        });
        Assert.Equal(500, cert.TaxPoints);
        Assert.True(cert.AutoRecord);
        Assert.Equal(new Next(2, Today, "Profit 2", 1_311_000, "Auto", false), cert.Next);

        Assert.Equal(1, await RunRecorder());
        var detail = await Get(client, cert.Id);
        Assert.Equal(2, detail.Saving.Done);
        Assert.Equal(100_000_000 + 1_311_000, await Balance(client, bank));
        Assert.Equal(new[] { "PaidBefore", "Paid", "Due" }, detail.Schedule.Take(3).Select(r => r.Status));
        Assert.Equal(1_380_000, (await client.GetFromJsonAsync<ListResult>("/api/savings"))!.Summary.TaxYear.Profit);

        var closed = await Act(client, cert.Id, "close", new { received = 49_000_000 });
        Assert.True(closed.Closed);
        Assert.Equal(100_000_000 + 1_311_000 + 49_000_000, await Balance(client, bank));
        Assert.Contains((await Get(client, cert.Id)).Activity, t => t.Note == "Early encashment charge" && t.Amount == 1_000_000);
    }

    [Fact]
    public async Task Prize_bonds_win_with_tax_and_can_be_sold_back()
    {
        var (client, bank) = await Account();
        var bonds = await Add(client, new
        {
            kind = "PrizeBond", name = "Prize bonds", payFromWalletId = bank, fromWalletId = bank, bondCount = 30, startDate = Today,
            bondNumbers = new[] { "কখ 0412301", "কখ 0412302" },
        });
        Assert.Equal(30, bonds.BondCount);
        Assert.Equal(300_000, bonds.Balance);
        Assert.Equal(2000, bonds.TaxPoints);
        Assert.Equal(SavingMath.NextDraw(Today), bonds.NextDraw);
        Assert.Equal(Today > SavingMath.DrawCutoff(SavingMath.NextDraw(Today)) ? 0 : 30, bonds.BondsInDraw);
        Assert.Equal(new[] { "কখ 0412301", "কখ 0412302" }, bonds.BondNumbers);

        var won = await Act(client, bonds.Id, "prize", new { prize = 1_000_000, bond = "কখ 0412302" });
        Assert.Equal(1_000_000, won.ProfitReceived);
        Assert.Equal(200_000, won.TaxTaken);
        Assert.Equal(100_000_000 - 300_000 + 800_000, await Balance(client, bank));

        var sold = await Act(client, bonds.Id, "sell", new { bondCount = 30 });
        Assert.True(sold.Closed);
        Assert.Equal(100_000_000 + 800_000, await Balance(client, bank));
    }

    [Fact]
    public async Task A_policy_takes_premiums_under_insurance_and_pays_claims_as_income()
    {
        var (client, bank) = await Account();
        var policy = await Add(client, new
        {
            kind = "Insurance", name = "Life policy", provider = "Guardian Life", payFromWalletId = bank, amount = 4_850_000, months = 180, everyMonths = 12,
            startDate = Today.AddYears(-6), paidBefore = 6, policy = "Life", cover = 100_000_000, policyNumber = "GL-2021-458 310", nominee = "Ayesha",
        });
        Assert.Null(policy.WalletId);
        Assert.Equal(15, policy.Total);
        Assert.Equal(new Next(7, Today, "Premium 7", 4_850_000, "Pay", false), policy.Next);
        Assert.Equal(Today.AddDays(30), policy.GraceEnds);
        Assert.True(policy.Remind);

        var paid = await Act(client, policy.Id, "premium", new { });
        Assert.Equal(7, paid.Done);
        Assert.Equal(7 * 4_850_000, paid.PaidSoFar);
        var premium = (await Get(client, policy.Id)).Activity.Single();
        Assert.Equal("Life", premium.CategoryName);

        await Act(client, policy.Id, "payout", new { amount = 1_000_000, kind = "Claim" });
        Assert.Contains((await Get(client, policy.Id)).Activity, t => t.CategoryName == "Insurance payouts");
        var matured = await Act(client, policy.Id, "payout", new { amount = 150_000_000, kind = "Maturity" });
        Assert.True(matured.Closed);
        Assert.Equal(100_000_000 - 4_850_000 + 1_000_000 + 150_000_000, await Balance(client, bank));
    }

    [Fact]
    public async Task Savings_rows_and_wallets_change_only_from_Savings()
    {
        var (client, bank) = await Account();
        var fdr = await Add(client, Fdr(bank, Today));
        var opened = (await Get(client, fdr.Id)).Activity.Single();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync($"/api/transactions/{opened.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync($"/api/wallets/{fdr.WalletId}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync($"/api/wallets/{fdr.WalletId}/archive", null)).StatusCode);
        var spend = await client.PostAsJsonAsync("/api/transactions", new { type = "Expense", amount = 100, fromWalletId = fdr.WalletId, occurredAt = DateTimeOffset.UtcNow });
        Assert.Equal(HttpStatusCode.BadRequest, spend.StatusCode);
        var create = await client.PostAsJsonAsync("/api/wallets", new { type = "Savings", name = "Mine", openingBalance = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
    }

    [Fact]
    public async Task A_term_that_is_not_whole_payments_or_a_policy_without_a_type_is_refused()
    {
        var (client, bank) = await Account();

        var fdr = await client.PostAsJsonAsync("/api/savings", new { kind = "Fdr", name = "FDR", payFromWalletId = bank, alreadyHeld = true, amount = 100, months = 10, everyMonths = 3, startDate = Today });
        var policy = await client.PostAsJsonAsync("/api/savings", new { kind = "Insurance", name = "Policy", payFromWalletId = bank, amount = 100, everyMonths = 12, startDate = Today });

        Assert.Equal(HttpStatusCode.BadRequest, fdr.StatusCode);
        Assert.Contains("everyMonths", await fdr.Content.ReadAsStringAsync());
        Assert.Contains("policy", await policy.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Deleting_removes_the_rows_and_the_wallet()
    {
        var (client, bank) = await Account();
        var fdr = await Add(client, Fdr(bank, Today));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/savings/{fdr.Id}")).StatusCode);

        Assert.Equal(100_000_000, await Balance(client, bank));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/savings/{fdr.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/wallets/{fdr.WalletId}")).StatusCode);
    }

    [Fact]
    public async Task Another_account_cannot_see_or_change_a_saving()
    {
        var (client, bank) = await Account();
        var fdr = await Add(client, Fdr(bank, Today));
        var (other, _) = await auth.SignedInClient();

        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/savings/{fdr.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsJsonAsync($"/api/savings/{fdr.Id}/close", new { received = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync($"/api/savings/{fdr.Id}")).StatusCode);
        var stolen = await other.PostAsJsonAsync("/api/savings", new { kind = "Fdr", name = "FDR", payFromWalletId = bank, alreadyHeld = true, amount = 100, months = 12, startDate = Today });
        Assert.Equal(HttpStatusCode.BadRequest, stolen.StatusCode);
    }

    [Fact]
    public async Task The_tax_year_exports_as_CSV()
    {
        var (client, bank) = await Account();
        await Add(client, Fdr(bank, Today));

        var response = await client.GetAsync("/api/savings/tax-year.csv");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var csv = await response.Content.ReadAsStringAsync();
        Assert.Contains("City Bank FDR,Fdr,Deposit,500000.00,City Bank account", csv);
    }

    [Fact]
    public async Task A_DPS_made_on_the_phone_syncs_and_its_rows_are_checked()
    {
        var (client, bank) = await Account();
        var walletId = Guid.CreateVersion7();
        var savingId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        object Row(string type, long amount, Guid? from, Guid? to, string part, int? seq) => new
        {
            id = Guid.CreateVersion7(), type, amount, fromWalletId = from, toWalletId = to, categoryId = (Guid?)null, personId = (Guid?)null, feeOfId = (Guid?)null,
            recurringRuleId = (Guid?)null, recurringDate = (DateOnly?)null, occurredAt = now, note = (string?)null, updatedAt = now,
            deletedAt = (DateTimeOffset?)null, savingId, savingSeq = seq, savingPart = part,
        };

        var results = await SyncTests.Push(
            client,
            SyncTests.Change("wallets", SyncTests.Wallet(walletId, "Phone DPS", 0, type: "Savings")),
            SyncTests.Change("savings", new
            {
                id = savingId, kind = "Dps", name = "Phone DPS", provider = (string?)null, walletId, payFromWalletId = bank, amount = 500_000, ratePoints = 900,
                months = 36, everyMonths = 1, startDate = Today, taxPoints = 1000, chargesPerYear = 0, maturityAmount = (long?)null, cover = (long?)null,
                policy = (string?)null, policyNumber = (string?)null, insured = (string?)null, nominee = (string?)null, bondNumbers = (string?)null,
                paidBefore = 0, autoRecord = false, remind = false, renew = false, missed = (string?)null, seqBase = 0, closedOn = (DateOnly?)null,
                updatedAt = now, deletedAt = (DateTimeOffset?)null,
            }),
            SyncTests.Change("transactions", Row("Transfer", 500_000, bank, walletId, "Deposit", 1)));

        Assert.All(results, r => Assert.True(r.Status == "accepted", r.Reason));
        var detail = await Get(client, savingId);
        Assert.Equal(500_000, detail.Saving.Balance);
        Assert.Equal(2, detail.Saving.Next!.Number);
        Assert.Contains((await SyncTests.Pull(client)).Savings, s => s.GetProperty("id").GetGuid() == savingId);

        var wrong = await SyncTests.Push(client, SyncTests.Change("transactions", Row("Transfer", 100, walletId, walletId, "Deposit", 2)));
        Assert.Equal("rejected", Assert.Single(wrong).Status);
        var profit = await SyncTests.Push(client, SyncTests.Change("transactions", Row("Income", 100, null, bank, "Profit", null)));
        Assert.Equal("accepted", Assert.Single(profit).Status);
        Assert.NotEqual(JsonValueKind.Null, profit[0].Current!.Value.GetProperty("categoryId").ValueKind);
    }
}
