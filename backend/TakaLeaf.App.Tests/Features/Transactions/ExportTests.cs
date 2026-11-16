using System.Net;
using System.Net.Http.Json;
using System.Text;
using TakaLeaf.App.Features.Transactions;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Wallets;

namespace TakaLeaf.App.Tests.Features.Transactions;

/// <summary>CSV export (P-5).</summary>
[Collection(DatabaseCollection.Name)]
public class ExportTests(DatabaseFixture fixture)
{
    private readonly AuthClient auth = new(fixture);

    private sealed record TotalsResult(long Income, long Expense);

    private sealed record PageResult(int TotalCount, TotalsResult Totals);

    private static List<string[]> Parse(string csv)
    {
        var rows = new List<string[]>();
        var cells = new List<string>();
        var cell = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < csv.Length; i++)
        {
            var c = csv[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < csv.Length && csv[i + 1] == '"') { cell.Append('"'); i++; }
                else if (c == '"') { quoted = false; }
                else { cell.Append(c); }
            }
            else if (c == '"') { quoted = true; }
            else if (c == ',') { cells.Add(cell.ToString()); cell.Clear(); }
            else if (c == '\r') { }
            else if (c == '\n') { cells.Add(cell.ToString()); cell.Clear(); rows.Add([.. cells]); cells.Clear(); }
            else { cell.Append(c); }
        }

        return rows;
    }

    // P-5
    [Fact]
    public async Task The_export_holds_exactly_the_filtered_rows_in_spreadsheet_safe_form()
    {
        var (client, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(client, new { type = "Cash", name = "Cash, pocket", openingBalance = 1000000 });
        var bank = await WalletTests.Create(client, new { type = "Bank", name = "Bank" });
        var rent = await TransactionTests.Category(client, "Expense", "Housing", "House rent");
        await TransactionTests.Add(client, new { type = "Expense", amount = 125050, fromWalletId = cash.Id, categoryId = rent, note = "Rent \"Nov\"", occurredAt = "2026-11-05T21:15:00+06:00" });
        await TransactionTests.Add(client, new { type = "Expense", amount = 5000, fromWalletId = cash.Id, note = "=HYPERLINK(\"http://x\")", occurredAt = "2026-11-06T09:00:00+06:00" });
        await TransactionTests.Add(client, new { type = "Transfer", amount = 200000, fromWalletId = cash.Id, toWalletId = bank.Id, fee = 1850, occurredAt = "2026-11-07T09:00:00+06:00" });
        await TransactionTests.Add(client, new { type = "Expense", amount = 7000, fromWalletId = cash.Id, occurredAt = "2026-10-20T09:00:00+06:00" });

        const string filter = "from=2026-11-01&to=2026-11-30&type=Expense";
        var response = await client.GetAsync($"/api/transactions/export.csv?{filter}");
        var bytes = await response.Content.ReadAsByteArrayAsync();
        var rows = Parse(Encoding.UTF8.GetString(bytes[3..]));
        var list = (await client.GetFromJsonAsync<PageResult>($"/api/transactions?{filter}"))!;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("takaleaf-transactions-2026-11-01-to-2026-11-30.csv", response.Content.Headers.ContentDisposition?.FileNameStar ?? response.Content.Headers.ContentDisposition?.FileName);
        Assert.Equal(Encoding.UTF8.GetPreamble(), bytes[..3]);
        Assert.Equal(["Date", "Time", "Type", "Amount (BDT)", "From wallet", "To wallet", "Category", "Note", "Kind"], rows[0]);
        var data = rows.Skip(1).ToList();
        Assert.Equal(list.TotalCount, data.Count);
        Assert.Equal(list.Totals.Expense, data.Sum(r => (long)Math.Round(decimal.Parse(r[3], System.Globalization.CultureInfo.InvariantCulture) * 100)));

        Assert.Equal(["2026-11-05", "21:15", "Expense", "1250.50", "Cash, pocket", "", "Housing / House rent", "Rent \"Nov\"", ""], data[0]);
        Assert.Equal("'=HYPERLINK(\"http://x\")", data[1][7]);
        Assert.Equal(("18.50", "Transfer fee"), (data[2][3], data[2][8]));
    }

    [Fact]
    public async Task Another_account_exports_nothing_of_mine()
    {
        var (owner, _) = await auth.SignedInClient();
        var (stranger, _) = await auth.SignedInClient();
        var cash = await WalletTests.Create(owner, new { type = "Cash", name = "Cash", openingBalance = 100000 });
        await TransactionTests.Add(owner, new { type = "Expense", amount = 1000, fromWalletId = cash.Id });

        var csv = await stranger.GetStringAsync($"/api/transactions/export.csv?walletId={cash.Id}");

        Assert.Single(Parse(csv.TrimStart('﻿')));
    }

    [Theory]
    [InlineData(125050, "1250.50")]
    [InlineData(5, "0.05")]
    [InlineData(100000000, "1000000.00")]
    public void Amounts_are_plain_taka(long poisha, string text) => Assert.Equal(text, ExportTransactions.Taka(poisha));
}
