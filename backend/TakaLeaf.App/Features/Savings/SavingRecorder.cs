using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Savings;

/// <summary>
/// Records what banks do by themselves, at 9 am on the day: DPS instalments set to automatic,
/// FDR profit and maturity (renewing or paying out), and certificate profit and maturity set to
/// automatic. Policies and prize bonds are left to the user.
/// </summary>
public sealed class SavingRecorder(AppDbContext db, LocalCalendar calendar)
{
    public async Task<int> RecordDueAsync(CancellationToken cancellationToken)
    {
        var today = calendar.Today();
        var savings = await db.Savings
            .Where(s => s.ClosedOn == null && s.AutoRecord && s.StartDate <= today
                && (s.Kind == SavingKind.Dps || s.Kind == SavingKind.Fdr || s.Kind == SavingKind.Certificate))
            .ToListAsync(cancellationToken);
        var recorded = 0;
        foreach (var saving in savings)
        {
            for (var i = 0; i < SavingRules.MaxCatchUp; i++)
            {
                var state = (await SavingRules.StatesAsync(db, calendar, saving.UserId, [saving], cancellationToken))[saving.Id];
                if (state.Next is not { } next || next.Date > today || saving.ClosedOn is not null)
                {
                    break;
                }

                // A deleted or archived account stops it: the entry waits in the due list.
                if (!await db.Wallets.AnyAsync(w => w.Id == saving.PayFromWalletId && !w.Archived, cancellationToken))
                {
                    break;
                }

                var at = calendar.StartOf(next.Date) + TimeSpan.FromHours(9);
                if (!await RecordAsync(saving, state, next, at, cancellationToken))
                {
                    break;
                }

                try
                {
                    await db.SaveChangesAsync(cancellationToken);
                    recorded++;
                }
                catch (DbUpdateException)
                {
                    // Recorded at the same moment elsewhere (the phone, a second server); try next run.
                    db.ChangeTracker.Clear();
                    break;
                }
            }
        }

        return recorded;
    }

    private async Task<bool> RecordAsync(Saving s, SavingState state, SavingNextDto next, DateTimeOffset at, CancellationToken cancellationToken)
    {
        switch (s.Kind)
        {
            case SavingKind.Dps when next.Number is { } n:
                db.Transactions.Add(SavingRules.Row(s, SavingPart.Deposit, TransactionType.Transfer, s.Amount, s.PayFromWalletId, s.WalletId, null, n, at, $"{s.Name} instalment {n}"));
                return true;
            case SavingKind.Fdr or SavingKind.Certificate when next.Label.StartsWith("Profit", StringComparison.Ordinal):
            {
                var gross = SavingRules.PeriodProfit(s);
                await SavingRules.AddProfitAsync(db, s, s.PayFromWalletId, gross, SavingMath.Tax(gross, s.TaxPoints), s.SeqBase + state.ProfitDone + 1, at, cancellationToken);
                return true;
            }

            case SavingKind.Fdr when s.Renew:
                await SavingRules.AddRenewAsync(db, s, state.Balance, null, at, cancellationToken);
                return true;
            case SavingKind.Fdr or SavingKind.Certificate:
            {
                var (received, tax, charges) = SavingActions.Expected(s, state.Balance);
                await SavingRules.AddCloseAsync(db, s, state.Balance, s.PayFromWalletId, received, tax, charges, s.SeqBase + SavingRules.Periods(s), at, next.Date, cancellationToken);
                return true;
            }

            default:
                // A matured DPS waits for the user to say what the bank paid.
                return false;
        }
    }
}

public sealed class SavingOptions
{
    public const string Section = "Savings";

    /// <summary>Whether the background worker runs. Tests turn it off and call the recorder directly.</summary>
    public bool Enabled { get; set; } = true;

    public int PollMinutes { get; set; } = 30;
}

public sealed class SavingWorker(IServiceScopeFactory scopes, IOptions<SavingOptions> options, ILogger<SavingWorker> logger) : BackgroundService
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
                var recorded = await scope.ServiceProvider.GetRequiredService<SavingRecorder>().RecordDueAsync(stoppingToken);
                if (recorded > 0)
                {
                    logger.LogInformation("Recorded {Count} savings entries", recorded);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Recording savings entries failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
