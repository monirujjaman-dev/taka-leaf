using System.Globalization;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>
/// GET /api/transactions/export.csv - every transaction matching the history filters, oldest
/// first, as a CSV file that opens in Excel, LibreOffice and Google Sheets. Amounts are in taka with
/// two decimals ("1250.00"), dates and times are local.
/// </summary>
public static class ExportTransactions
{
    private static readonly string[] Header =
        ["Date", "Time", "Type", "Amount (BDT)", "From wallet", "To wallet", "Category", "Note", "Kind"];

    public static RouteGroupBuilder MapExportTransactions(this RouteGroupBuilder group)
    {
        group.MapGet("/export.csv", Handle).WithName("ExportTransactions").Produces(StatusCodes.Status200OK, contentType: "text/csv");
        return group;
    }

    private static async Task<IResult> Handle(
        [AsParameters] TransactionFilter filter,
        ClaimsPrincipal principal,
        AppDbContext db,
        LocalCalendar calendar,
        CancellationToken cancellationToken)
    {
        var userId = principal.UserId();
        var query = await filter.ApplyAsync(db, userId, calendar, cancellationToken);
        var rows = await query.OrderBy(t => t.OccurredAt).ThenBy(t => t.CreatedAt).ToListAsync(cancellationToken);

        var wallets = await db.Wallets.IgnoreQueryFilters().Where(w => w.UserId == userId).ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
        var categories = await db.Categories.IgnoreQueryFilters().Where(c => c.UserId == userId).ToDictionaryAsync(c => c.Id, cancellationToken);

        string Wallet(Guid? id) => id is { } key && wallets.TryGetValue(key, out var name) ? name : "";
        string Category(Guid? id)
        {
            if (id is not { } key || !categories.TryGetValue(key, out var category))
            {
                return "";
            }

            return category.ParentId is { } parent && categories.TryGetValue(parent, out var top) ? $"{top.Name} / {category.Name}" : category.Name;
        }

        var csv = new StringBuilder();
        AppendRow(csv, Header);
        foreach (var t in rows)
        {
            var local = calendar.ToLocal(t.OccurredAt);
            AppendRow(csv,
            [
                local.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                local.ToString("HH:mm", CultureInfo.InvariantCulture),
                t.Type.ToString(),
                Taka(t.Amount),
                Wallet(t.FromWalletId),
                Wallet(t.ToWalletId),
                Category(t.CategoryId),
                t.Note ?? "",
                t.FeeOfId is not null ? "Transfer fee" : t.PersonId is not null ? "Loan" : t.LoanId is not null ? "Bank loan or card EMI" : t.SavingId is not null ? "Savings or insurance" : t.RecurringRuleId is not null ? "Recurring" : "",
            ]);
        }

        // A byte-order mark makes Excel read the file as UTF-8, so ৳ and Bengali names show correctly.
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        var name = $"takaleaf-transactions{(filter.From is { } f ? $"-{f:yyyy-MM-dd}" : "")}{(filter.To is { } to ? $"-to-{to:yyyy-MM-dd}" : "")}.csv";
        return Results.File(bytes, "text/csv; charset=utf-8", name);
    }

    /// <summary>Poisha as plain taka for spreadsheets: 125050 → "1250.50".</summary>
    public static string Taka(long poisha) =>
        $"{(poisha < 0 ? "-" : "")}{Math.Abs(poisha) / 100}.{Math.Abs(poisha) % 100:00}";

    internal static void AppendRow(StringBuilder csv, IReadOnlyList<string> cells)
    {
        for (var i = 0; i < cells.Count; i++)
        {
            if (i > 0)
            {
                csv.Append(',');
            }

            csv.Append(Escape(cells[i]));
        }

        csv.Append("\r\n");
    }

    /// <summary>
    /// Quotes when needed, and stops a note like "=HYPERLINK(...)" from running as a formula when
    /// the file is opened in a spreadsheet.
    /// </summary>
    private static string Escape(string value)
    {
        if (value.Length > 0 && "=+-@\t\r".Contains(value[0]))
        {
            value = "'" + value;
        }

        return value.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\"" : value;
    }
}
