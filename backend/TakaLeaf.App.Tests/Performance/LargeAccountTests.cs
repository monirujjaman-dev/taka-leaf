using System.Diagnostics;
using System.Net;
using Microsoft.Extensions.DependencyInjection;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Tests.Data;
using TakaLeaf.App.Tests.Features.Auth;
using TakaLeaf.App.Tests.Features.Wallets;
using Xunit.Abstractions;

namespace TakaLeaf.App.Tests.Performance;

/// <summary>
/// Performance target from the testing plan (§6): with 50,000 transactions, list, dashboard and
/// report endpoints answer within 300 ms for 95% of requests. Timings are printed with
/// --logger "console;verbosity=normal".
/// </summary>
[Collection(DatabaseCollection.Name)]
public class LargeAccountTests(DatabaseFixture fixture, ITestOutputHelper output)
{
    public const int Transactions = 50_000;
    private const int Runs = 20;
    private static readonly TimeSpan Target = TimeSpan.FromMilliseconds(300);

    private readonly AuthClient auth = new(fixture);

    [Fact]
    public async Task Endpoints_stay_fast_with_fifty_thousand_transactions()
    {
        var (client, session) = await auth.SignedInClient();
        var walletIds = new List<Guid>();
        foreach (var (type, name) in new[] { ("Cash", "Cash"), ("Bank", "City Bank"), ("Mfs", "bKash"), ("Mfs", "Nagad"), ("CreditCard", "Visa") })
        {
            walletIds.Add((await WalletTests.Create(client, new { type, name, openingBalance = 100000000 })).Id);
        }

        await client.GetAsync("/api/categories");
        await Seed(session.User.Id, walletIds);

        string[] paths =
        [
            "/api/transactions",
            "/api/transactions?page=50",
            $"/api/transactions?walletId={walletIds[2]}&from=2026-01-01&to=2026-12-31",
            "/api/transactions?search=bazaar",
            "/api/dashboard",
            "/api/wallets",
            "/api/reports",
            "/api/reports?period=Year&year=2026",
            "/api/budgets",
            "/api/people",
        ];

        var slow = new List<string>();
        foreach (var path in paths)
        {
            for (var i = 0; i < 2; i++)
            {
                (await client.GetAsync(path)).EnsureSuccessStatusCode();
            }

            var times = new List<double>();
            for (var i = 0; i < Runs; i++)
            {
                var watch = Stopwatch.StartNew();
                var response = await client.GetAsync(path);
                watch.Stop();
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                times.Add(watch.Elapsed.TotalMilliseconds);
            }

            times.Sort();
            var p95 = times[(int)Math.Ceiling(Runs * 0.95) - 1];
            output.WriteLine($"{path,-75} median {times[Runs / 2],6:0.0} ms   p95 {p95,6:0.0} ms");
            if (p95 > Target.TotalMilliseconds)
            {
                slow.Add($"{path}: p95 {p95:0} ms");
            }
        }

        Assert.Empty(slow);
    }

    /// <summary>Two years of realistic activity, written straight to the database.</summary>
    private async Task Seed(Guid userId, List<Guid> wallets)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var categories = db.Categories.Where(c => c.UserId == userId && c.ParentId != null).Select(c => new { c.Id, c.Kind }).ToList();
        var expense = categories.Where(c => c.Kind == CategoryKind.Expense).Select(c => c.Id).ToArray();
        var income = categories.Where(c => c.Kind == CategoryKind.Income).Select(c => c.Id).ToArray();
        var random = new Random(42);
        var start = new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero);
        string[] notes = ["Weekly bazaar", "Bus to office", "Rickshaw", "Tea", "Mobile recharge", "Groceries", "Lunch", ""];

        var batch = new List<Transaction>(5_000);
        for (var i = 0; i < Transactions; i++)
        {
            var roll = random.Next(100);
            var from = wallets[random.Next(wallets.Count)];
            var to = wallets[random.Next(wallets.Count)];
            var transaction = new Transaction
            {
                UserId = userId,
                Amount = random.Next(1_000, 500_000),
                OccurredAt = start.AddMinutes(random.Next(0, 2 * 365 * 24 * 60)),
                Note = notes[random.Next(notes.Length)] is { Length: > 0 } note ? note : null,
            };
            if (roll < 70)
            {
                transaction.Type = TransactionType.Expense;
                transaction.FromWalletId = from;
                transaction.CategoryId = expense[random.Next(expense.Length)];
            }
            else if (roll < 90)
            {
                transaction.Type = TransactionType.Income;
                transaction.ToWalletId = to;
                transaction.CategoryId = income[random.Next(income.Length)];
            }
            else
            {
                transaction.Type = TransactionType.Transfer;
                transaction.FromWalletId = from;
                transaction.ToWalletId = from == to ? wallets[(wallets.IndexOf(from) + 1) % wallets.Count] : to;
            }

            batch.Add(transaction);
            if (batch.Count == batch.Capacity)
            {
                db.Transactions.AddRange(batch);
                await db.SaveChangesAsync();
                db.ChangeTracker.Clear();
                batch.Clear();
            }
        }

        db.Transactions.AddRange(batch);
        await db.SaveChangesAsync();
    }
}
