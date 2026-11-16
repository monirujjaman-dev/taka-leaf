using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Data;

/// <summary>
/// The categories every new account starts with (requirements, section 4). People can rename,
/// merge, archive or delete them like any other.
/// </summary>
public static class StarterCategories
{
    private sealed record Starter(CategoryKind Kind, string Name, string Icon, string[] Children);

    private static readonly Starter[] All =
    [
        new(CategoryKind.Expense, "Housing", "home", ["House rent", "Utilities", "Internet", "Maintenance"]),
        new(CategoryKind.Expense, "Transport", "bus", ["Bus fare", "Rickshaw and CNG", "Ride sharing", "Fuel"]),
        new(CategoryKind.Expense, "Groceries and household", "cart", ["Daily bazaar", "Household items"]),
        new(CategoryKind.Expense, "Food and dining", "food", ["Restaurants", "Snacks and tea"]),
        new(CategoryKind.Expense, "Self-development", "book", ["Courses", "Books", "Certifications"]),
        new(CategoryKind.Expense, "Learning tools", "chip", ["Cloud server", "AI subscriptions", "Software", "Domain and hosting"]),
        new(CategoryKind.Expense, "Family support", "heart", ["Parents", "Younger sister", "Wife's pocket money"]),
        new(CategoryKind.Expense, "Health", "pulse", ["Doctor", "Medicine"]),
        new(CategoryKind.Expense, "Mobile and communication", "phone", ["Mobile recharge", "Data packs"]),
        new(CategoryKind.Expense, "Personal", "user", ["Clothing", "Grooming", "Entertainment"]),
        new(CategoryKind.Expense, "Gifts and donations", "gift", ["Gifts", "Charity", "Zakat"]),
        new(CategoryKind.Expense, "Fees and charges", "percent", ["Bank charges", "MFS charges", "Credit card interest"]),
        new(CategoryKind.Expense, "Other", "dots", ["Uncategorised"]),
        new(CategoryKind.Income, "Salary", "brief", ["Monthly salary", "Bonus"]),
        new(CategoryKind.Income, "Freelance and side income", "laptop", ["Projects", "Consulting"]),
        new(CategoryKind.Income, "Other income", "plus", ["Gifts received", "Refunds", "Interest and profit"]),
    ];

    public static int ParentCount(CategoryKind kind) => All.Count(s => s.Kind == kind);

    /// <summary>
    /// Adds the starter categories unless the account has ever had a category, deleted ones
    /// included, so someone who deleted them all does not get them back.
    /// </summary>
    public static async Task EnsureAsync(AppDbContext db, Guid userId, CancellationToken cancellationToken)
    {
        if (await db.Categories.IgnoreQueryFilters().AnyAsync(c => c.UserId == userId, cancellationToken))
        {
            return;
        }

        var order = 0;
        foreach (var starter in All)
        {
            var parent = new Category
            {
                UserId = userId,
                Kind = starter.Kind,
                Name = starter.Name,
                Icon = starter.Icon,
                SortOrder = order++,
            };
            db.Categories.Add(parent);

            var childOrder = 0;
            foreach (var child in starter.Children)
            {
                db.Categories.Add(new Category
                {
                    UserId = userId,
                    Kind = starter.Kind,
                    Name = child,
                    ParentId = parent.Id,
                    SortOrder = childOrder++,
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
