using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Recurring;

/// <summary>Records one due date of a rule as a transaction and moves the rule on, in one save.</summary>
public sealed class RecurringRecorder(AppDbContext db, LocalCalendar calendar, TimeProvider clock)
{
    /// <returns>The transaction, or the problem that stopped it (a deleted wallet, for example).</returns>
    public async Task<(Transaction? Transaction, IResult? Problem)> RecordNextAsync(
        RecurringRule rule, long? amount, DateTimeOffset? occurredAt, CancellationToken cancellationToken)
    {
        var date = rule.NextDate;
        var when = (occurredAt ?? calendar.StartOf(date) + RecurringRules.RecordTimeOfDay).ToUniversalTime();
        var request = new TransactionRequest(
            rule.Type, amount ?? rule.Amount, rule.FromWalletId, rule.ToWalletId, rule.CategoryId, when, rule.Note, null, null);

        // The rule's own wallets and category count as already chosen, so archiving one later
        // does not stop the rule; deleting one does.
        var (input, problem) = await TransactionRules.CheckAsync(
            db, rule.UserId, request, RecurringRules.AsTransaction(rule), null, clock.GetUtcNow(), cancellationToken);
        if (problem is not null)
        {
            return (null, problem);
        }

        var transaction = new Transaction { UserId = rule.UserId, RecurringRuleId = rule.Id, RecurringDate = date };
        TransactionRules.Apply(transaction, input!);
        db.Transactions.Add(transaction);
        RecurringRules.Advance(rule);
        await db.SaveChangesAsync(cancellationToken);
        return (transaction, null);
    }

    /// <summary>
    /// Records every automatic rule that has fallen due, for every user. A rule that cannot be
    /// recorded is left due, so it shows in the user's list to sort out by hand.
    /// </summary>
    public async Task<int> RecordAutomaticAsync(CancellationToken cancellationToken)
    {
        var today = calendar.Today();
        var rules = await db.RecurringRules
            .Where(r => r.AutoRecord && !r.Paused && r.NextDate <= today && (r.EndDate == null || r.NextDate <= r.EndDate))
            .ToListAsync(cancellationToken);

        var recorded = 0;
        foreach (var rule in rules)
        {
            for (var i = 0; i < RecurringRules.MaxCatchUp && rule.NextDate <= today && !RecurringRules.Ended(rule); i++)
            {
                try
                {
                    var (transaction, _) = await RecordNextAsync(rule, null, null, cancellationToken);
                    if (transaction is null)
                    {
                        break;
                    }

                    recorded++;
                }
                catch (DbUpdateException)
                {
                    // The same date was recorded at the same moment elsewhere; leave this rule for the next run.
                    db.ChangeTracker.Clear();
                    break;
                }
            }
        }

        return recorded;
    }
}

public sealed class RecurringOptions
{
    public const string Section = "Recurring";

    /// <summary>Whether the background worker runs. Tests turn it off and call the recorder directly.</summary>
    public bool Enabled { get; set; } = true;

    public int PollMinutes { get; set; } = 30;
}

/// <summary>At start-up and then every PollMinutes, records automatic recurring transactions that are due.</summary>
public sealed class RecurringWorker(IServiceScopeFactory scopes, IOptions<RecurringOptions> options, ILogger<RecurringWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(1, options.Value.PollMinutes)));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var recorded = await scope.ServiceProvider.GetRequiredService<RecurringRecorder>().RecordAutomaticAsync(stoppingToken);
                if (recorded > 0)
                {
                    logger.LogInformation("Recorded {Count} recurring transactions", recorded);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Recording recurring transactions failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
