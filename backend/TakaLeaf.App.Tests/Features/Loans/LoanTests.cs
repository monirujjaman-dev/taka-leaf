using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Common;
using TakaLeaf.App.Features.Loans;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Sync;
using TakaLeaf.App.Tests.Features.Transactions;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Loans;

[Collection(DatabaseCollection.Name)]
public class LoanTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    public sealed record NextEmi(int Number, DateOnly DueDate, long Principal, long Interest, long Total, bool Overdue);

    public sealed record LoanResult(
        Guid Id, string Type, string Name, string? Lender, Guid WalletId, Guid PayFromWalletId, string? PayFromWalletName, long Principal,
        int RatePoints, int Months, long Emi, DateOnly FirstDueDate, int PaidBefore, bool AutoRecord, DateOnly? ClosedOn, long Outstanding,
        int Paid, int Left, bool Closed, NextEmi? Next, DateOnly? EndsOn, long InterestPaid, long InterestLeft);

    private sealed record Summary(long Outstanding, long Bank, long CardEmi, List<JsonElement> Upcoming);

    private sealed record ListResult(Summary Summary, List<LoanResult> Loans);

    private sealed record ScheduleRow(int Number, DateOnly DueDate, string Status, long Principal, long Interest, long Total, long? BalanceAfter);

    private sealed record CardLimit(Guid CardId, string CardName, long? Limit, long Spent, long Held, long? Available);

    private sealed record Detail(LoanResult Loan, List<ScheduleRow> Schedule, List<TransactionTests.TransactionResult> Activity, CardLimit? Card);

    private DateOnly Today => fixture.Factory.Services.GetRequiredService<LocalCalendar>().Today();

    public static async Task<LoanResult> Add(HttpClient client, object body)
    {
        var response = await client.PostAsJsonAsync("/api/loans", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<LoanResult>())!;
    }

    private static async Task<LoanResult> Get(HttpClient client, Guid id) => (await client.GetFromJsonAsync<Detail>($"/api/loans/{id}"))!.Loan;

    private static async Task<long> Balance(HttpClient client, Guid walletId) =>
        (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{walletId}"))!.Balance;

    /// <summary>৳12,00,000 at 9.5 % for 60 months, first EMI a month from now.</summary>
    private async Task<(HttpClient Client, Guid Bank, LoanResult Loan)> HomeLoan(int paidBefore = 0, bool received = true)
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "City Bank account", openingBalance = 10_000_000 });
        var loan = await Add(client, new
        {
            type = "Bank", name = "Home loan", lender = "City Bank", payFromWalletId = bank.Id, principal = 120_000_000, ratePoints = 950,
            months = 60, firstDueDate = paidBefore > 0 ? Today.AddMonths(-paidBefore + 1) : Today.AddMonths(1), paidBefore,
            receivedInWalletId = received ? bank.Id : (Guid?)null,
        });
        return (client, bank.Id, loan);
    }

    [Fact]
    public async Task A_new_bank_loan_works_out_its_EMI_and_adds_the_money_to_the_wallet()
    {
        var (client, bank, loan) = await HomeLoan();

        Assert.Equal(2_520_223, loan.Emi);
        Assert.Equal(120_000_000, loan.Outstanding);
        Assert.Equal(new NextEmi(1, Today.AddMonths(1), 1_570_223, 950_000, 2_520_223, false), loan.Next);
        Assert.Equal(60, loan.Left);
        Assert.Equal(loan.FirstDueDate.AddMonths(59), loan.EndsOn);
        Assert.Equal(10_000_000 + 120_000_000, await Balance(client, bank));

        var wallets = await client.GetFromJsonAsync<JsonElement>("/api/wallets");
        Assert.Equal(120_000_000, wallets.GetProperty("totals").GetProperty("liabilities").GetInt64());
        var list = (await client.GetFromJsonAsync<ListResult>("/api/loans"))!;
        Assert.Equal(120_000_000, list.Summary.Bank);
        Assert.Single(list.Summary.Upcoming);
    }

    [Fact]
    public async Task A_loan_already_running_starts_from_what_is_left_today()
    {
        var (_, _, loan) = await HomeLoan(paidBefore: 18, received: false);

        Assert.Equal(89_751_312, loan.Outstanding);
        Assert.Equal(18, loan.Paid);
        Assert.Equal(19, loan.Next!.Number);
        Assert.Equal(1_809_692, loan.Next.Principal);
        Assert.Equal(710_531, loan.Next.Interest);
        Assert.Equal(15_115_326, loan.InterestPaid);
        Assert.Equal(42, loan.Left);
    }

    [Fact]
    public async Task Paying_an_EMI_splits_it_into_principal_and_interest()
    {
        var (client, bank, loan) = await HomeLoan();

        var response = await client.PostAsJsonAsync($"/api/loans/{loan.Id}/pay", new { lateFee = 50_000 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paid = (await response.Content.ReadFromJsonAsync<LoanResult>())!;
        Assert.Equal(120_000_000 - 1_570_223, paid.Outstanding);
        Assert.Equal(2, paid.Next!.Number);
        Assert.Equal(950_000, paid.InterestPaid);
        Assert.Equal(130_000_000 - 2_520_223 - 50_000, await Balance(client, bank));

        var detail = (await client.GetFromJsonAsync<Detail>($"/api/loans/{loan.Id}"))!;
        Assert.Contains(detail.Activity, t => t.CategoryName == "Loan interest" && t.Amount == 950_000);
        Assert.Contains(detail.Activity, t => t.Note == "Late fee" && t.Amount == 50_000);
        Assert.Equal(new[] { "Paid", "Due" }, detail.Schedule.Where(r => r.Number <= 2).OrderBy(r => r.Number).Select(r => r.Status));

        // Loan rows change only through the loan.
        var interest = detail.Activity.First(t => t.CategoryName == "Loan interest");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync($"/api/transactions/{interest.Id}")).StatusCode);
    }

    [Fact]
    public async Task A_different_amount_keeps_the_interest_and_moves_the_rest_to_principal()
    {
        var (client, _, loan) = await HomeLoan();

        var paid = (await (await client.PostAsJsonAsync($"/api/loans/{loan.Id}/pay", new { amount = 3_000_000 })).Content.ReadFromJsonAsync<LoanResult>())!;

        Assert.Equal(120_000_000 - (3_000_000 - 950_000), paid.Outstanding);
        var tooLittle = await client.PostAsJsonAsync($"/api/loans/{loan.Id}/pay", new { amount = 100 });
        Assert.Equal(HttpStatusCode.BadRequest, tooLittle.StatusCode);
    }

    [Fact]
    public async Task Undoing_the_last_EMI_puts_the_loan_back()
    {
        var (client, bank, loan) = await HomeLoan();
        await client.PostAsJsonAsync($"/api/loans/{loan.Id}/pay", new { });

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/loans/{loan.Id}/emis/last")).StatusCode);

        var back = await Get(client, loan.Id);
        Assert.Equal(120_000_000, back.Outstanding);
        Assert.Equal(1, back.Next!.Number);
        Assert.Equal(130_000_000, await Balance(client, bank));
    }

    [Fact]
    public async Task Settling_early_pays_what_is_left_plus_the_settlement_charge()
    {
        var (client, bank, loan) = await HomeLoan();
        await client.PostAsJsonAsync($"/api/loans/{loan.Id}/extra", new { amount = 20_000_000 });

        var response = await client.PostAsJsonAsync($"/api/loans/{loan.Id}/settle", new { chargePoints = 200 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var settled = (await response.Content.ReadFromJsonAsync<LoanResult>())!;
        Assert.True(settled.Closed);
        Assert.Equal(Today, settled.ClosedOn);
        Assert.Null(settled.Next);
        Assert.Equal(0, settled.Outstanding);
        // ৳10,00,000 left, 2 % charge = ৳20,000
        Assert.Equal(130_000_000 - 120_000_000 - 2_000_000, await Balance(client, bank));
        var detail = (await client.GetFromJsonAsync<Detail>($"/api/loans/{loan.Id}"))!;
        Assert.Contains(detail.Activity, t => t.Note == "Early settlement charge" && t.Amount == 2_000_000 && t.CategoryName == "Fees and charges");
        Assert.Equal(0, (await client.GetFromJsonAsync<ListResult>("/api/loans"))!.Summary.Outstanding);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/loans/{loan.Id}/pay", new { })).StatusCode);
    }

    [Fact]
    public async Task A_settlement_charge_can_be_an_amount()
    {
        var (client, bank, loan) = await HomeLoan();

        await client.PostAsJsonAsync($"/api/loans/{loan.Id}/settle", new { charge = 150_000 });

        Assert.Equal(130_000_000 - 120_000_000 - 150_000, await Balance(client, bank));
    }

    [Fact]
    public async Task A_card_EMI_records_the_purchase_holds_the_limit_and_bills_each_month()
    {
        var (client, _) = await auth.SignedInClient();
        var card = await WalletTests.Create(client, new { type = "CreditCard", name = "BRAC Bank Visa", openingBalance = -1_850_000, creditLimit = 20_000_000 });
        var laptop = await Add(client, new
        {
            type = "CardEmi", name = "Laptop EMI", payFromWalletId = card.Id, principal = 11_940_000, ratePoints = 0, months = 12,
            firstDueDate = Today.AddMonths(-2), processingFee = 119_400,
        });

        Assert.Equal(995_000, laptop.Emi);
        Assert.True(laptop.AutoRecord);
        Assert.Equal(1, laptop.Next!.Number);
        Assert.True(laptop.Next.Overdue);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<LoanRecorder>().RecordDueAsync(CancellationToken.None);
        }

        var billed = await Get(client, laptop.Id);
        Assert.Equal(3, billed.Paid);
        Assert.Equal(11_940_000 - 3 * 995_000, billed.Outstanding);
        Assert.Equal(-1_850_000 - 119_400 - 3 * 995_000, await Balance(client, card.Id));

        var limits = (await client.GetFromJsonAsync<Detail>($"/api/loans/{laptop.Id}"))!.Card!;
        Assert.Equal(11_940_000 - 3 * 995_000, limits.Held);
        Assert.Equal(20_000_000 - limits.Spent - limits.Held, limits.Available);
        var shown = (await client.GetFromJsonAsync<WalletTests.WalletResult>($"/api/wallets/{card.Id}"))!;
        Assert.Equal(limits.Available, shown.AvailableCredit);

        // The purchase is recorded a month before the first bill.
        var report = await client.GetFromJsonAsync<JsonElement>($"/api/dashboard?month={Today.AddMonths(-3):yyyy-MM}");
        Assert.True(report.GetProperty("expense").GetInt64() >= 11_940_000);
    }

    [Fact]
    public async Task Automatic_bank_EMIs_are_recorded_on_their_date()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "EBL account", openingBalance = 100_000_000 });
        var car = await Add(client, new
        {
            type = "Bank", name = "Car loan", lender = "EBL", payFromWalletId = bank.Id, principal = 90_000_000, ratePoints = 1025, months = 48,
            firstDueDate = Today.AddMonths(-1), autoRecord = true,
        });

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<LoanRecorder>().RecordDueAsync(CancellationToken.None);
        }

        var after = await Get(client, car.Id);
        Assert.Equal(2, after.Paid);
        Assert.Equal(100_000_000 - 2 * 2_293_453, await Balance(client, bank.Id));
    }

    [Fact]
    public async Task Loans_are_checked()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank" });
        var valid = new { type = "Bank", name = "Loan", payFromWalletId = bank.Id, principal = 100_000_000, ratePoints = 1200, months = 12, firstDueDate = Today };

        async Task<string> Problem(object body)
        {
            var response = await client.PostAsJsonAsync("/api/loans", body);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            return await response.Content.ReadAsStringAsync();
        }

        Assert.Contains("never ends", await Problem(new { valid.type, valid.name, valid.payFromWalletId, valid.principal, valid.ratePoints, valid.months, valid.firstDueDate, emi = 100 }));
        Assert.Contains("Choose a credit card", await Problem(new { type = "CardEmi", valid.name, valid.payFromWalletId, valid.principal, ratePoints = 0, valid.months, valid.firstDueDate }));
        Assert.Contains("0 to 100", await Problem(new { valid.type, valid.name, valid.payFromWalletId, valid.principal, ratePoints = 10_001, valid.months, valid.firstDueDate }));
        Assert.Contains("already paid", await Problem(new { valid.type, valid.name, valid.payFromWalletId, valid.principal, valid.ratePoints, valid.months, valid.firstDueDate, paidBefore = 12 }));

        var loan = await Add(client, valid);
        Assert.Contains("own wallets", await Problem(new { valid.type, valid.name, payFromWalletId = loan.WalletId, valid.principal, valid.ratePoints, valid.months, valid.firstDueDate }));
    }

    [Fact]
    public async Task A_loan_wallet_is_changed_only_through_its_loan()
    {
        var (client, bank, loan) = await HomeLoan();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync($"/api/wallets/{loan.WalletId}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"/api/wallets/{loan.WalletId}", new { name = "X", openingBalance = 0 })).StatusCode);
        var spend = await client.PostAsJsonAsync("/api/transactions", new { type = "Transfer", amount = 100, fromWalletId = bank, toWalletId = loan.WalletId });
        Assert.Contains("recorded from Loans", await spend.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/wallets", new { type = "Loan", name = "Sneaky" })).StatusCode);
    }

    [Fact]
    public async Task Changing_the_rate_applies_from_the_next_EMI()
    {
        var (client, _, loan) = await HomeLoan(paidBefore: 18, received: false);

        var response = await client.PutAsJsonAsync($"/api/loans/{loan.Id}", new { name = "Home loan", lender = "City Bank", ratePoints = 1050, emi = 2_600_000 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var changed = (await response.Content.ReadFromJsonAsync<LoanResult>())!;
        Assert.Equal(785_324, changed.Next!.Interest);
        Assert.Equal(2_600_000, changed.Next.Total);
        Assert.Equal(89_751_312, changed.Outstanding);
    }

    [Fact]
    public async Task Deleting_a_loan_removes_its_wallet_and_payments()
    {
        var (client, bank, loan) = await HomeLoan();
        await client.PostAsJsonAsync($"/api/loans/{loan.Id}/pay", new { });

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/loans/{loan.Id}")).StatusCode);

        Assert.Equal(10_000_000, await Balance(client, bank));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/wallets/{loan.WalletId}")).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<ListResult>("/api/loans"))!.Loans);
    }

    [Fact]
    public async Task Another_account_cannot_see_or_pay_a_loan()
    {
        var (_, _, loan) = await HomeLoan();
        var (stranger, _) = await auth.SignedInClient();

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/loans/{loan.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync($"/api/loans/{loan.Id}/pay", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/loans/{loan.Id}")).StatusCode);
        Assert.Empty((await stranger.GetFromJsonAsync<ListResult>("/api/loans"))!.Loans);
    }

    [Fact]
    public async Task A_loan_made_on_the_phone_syncs_and_its_interest_goes_under_loan_interest()
    {
        var (client, _) = await auth.SignedInClient();
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank", openingBalance = 10_000_000 });
        var walletId = Guid.CreateVersion7();
        var loanId = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        object Row(Guid id, string type, long amount, Guid? from, Guid? to, string part, int? emi) => new
        {
            id, type, amount, fromWalletId = from, toWalletId = to, categoryId = (Guid?)null, personId = (Guid?)null, feeOfId = (Guid?)null,
            recurringRuleId = (Guid?)null, recurringDate = (DateOnly?)null, occurredAt = now, note = (string?)null, updatedAt = now,
            deletedAt = (DateTimeOffset?)null, loanId = loanId, loanEmi = emi, loanPart = part,
        };

        var results = await SyncTests.Push(
            client,
            SyncTests.Change("wallets", SyncTests.Wallet(walletId, "Personal loan", -50_000_000, type: "Loan")),
            SyncTests.Change("loans", new
            {
                id = loanId, type = "Bank", name = "Personal loan", lender = "BRAC Bank", walletId, payFromWalletId = bank.Id, principal = 50_000_000,
                ratePoints = 1200, months = 12, emi = 4_442_439, firstDueDate = Today, paidBefore = 0, autoRecord = false,
                closedOn = (DateOnly?)null, updatedAt = now, deletedAt = (DateTimeOffset?)null,
            }),
            SyncTests.Change("transactions", Row(Guid.CreateVersion7(), "Transfer", 3_942_439, bank.Id, walletId, "Principal", 1)),
            SyncTests.Change("transactions", Row(Guid.CreateVersion7(), "Expense", 500_000, bank.Id, null, "Interest", 1)));

        Assert.All(results, r => Assert.True(r.Status == "accepted", r.Reason));
        Assert.NotEqual(JsonValueKind.Null, results[3].Current!.Value.GetProperty("categoryId").ValueKind);
        var loan = await Get(client, loanId);
        Assert.Equal(50_000_000 - 3_942_439, loan.Outstanding);
        Assert.Equal(2, loan.Next!.Number);
        Assert.Contains((await SyncTests.Pull(client)).Loans, l => l.GetProperty("id").GetGuid() == loanId);

        var wrong = await SyncTests.Push(client, SyncTests.Change("transactions", Row(Guid.CreateVersion7(), "Transfer", 100, walletId, bank.Id, "Principal", 2)));
        Assert.Equal("rejected", Assert.Single(wrong).Status);
    }
}
