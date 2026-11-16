using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Transactions;

/// <summary>
/// The history filters, read from the query string. The list and the CSV export use the same
/// filter, so an export holds exactly the rows the person was looking at.
/// </summary>
/// <param name="From">First local day, included.</param>
/// <param name="To">Last local day, included.</param>
/// <param name="CategoryId">A top-level category includes its sub-categories.</param>
/// <param name="Uncategorised">Only rows with no category.</param>
/// <param name="Search">Words in the note.</param>
public sealed record TransactionFilter(
    DateOnly? From,
    DateOnly? To,
    Guid? WalletId,
    Guid? CategoryId,
    bool? Uncategorised,
    TransactionType? Type,
    string? Search)
{
    public async Task<IQueryable<Transaction>> ApplyAsync(AppDbContext db, Guid userId, LocalCalendar calendar, CancellationToken cancellationToken)
    {
        var query = db.Transactions.Where(t => t.UserId == userId);

        if (From is { } firstDay)
        {
            var start = calendar.StartOf(firstDay);
            query = query.Where(t => t.OccurredAt >= start);
        }

        if (To is { } lastDay)
        {
            var end = calendar.StartOf(lastDay.AddDays(1));
            query = query.Where(t => t.OccurredAt < end);
        }

        if (WalletId is { } wallet)
        {
            query = query.Where(t => t.FromWalletId == wallet || t.ToWalletId == wallet);
        }

        if (CategoryId is { } category)
        {
            var ids = await db.Categories
                .Where(c => c.UserId == userId && (c.Id == category || c.ParentId == category))
                .Select(c => c.Id)
                .ToListAsync(cancellationToken);
            query = query.Where(t => t.CategoryId != null && ids.Contains(t.CategoryId.Value));
        }

        if (Uncategorised == true)
        {
            query = query.Where(t => t.CategoryId == null);
        }

        if (Type is { } onlyType)
        {
            query = query.Where(t => t.Type == onlyType);
        }

        if (Text.Clean(Search) is { } words)
        {
            var pattern = $"%{EscapeLike(words)}%";
            query = query.Where(t => t.Note != null && EF.Functions.ILike(t.Note, pattern, "\\"));
        }

        return query;
    }

    private static string EscapeLike(string text) =>
        text.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
}
