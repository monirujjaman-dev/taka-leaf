using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;

namespace TakaLeaf.App.Features.Loans;

/// <summary>
/// Records EMIs that fall due for card EMIs (the bank bills them to the card) and for bank loans
/// set to record automatically (auto-debit), at 9 am on the due date, from the paying wallet.
/// </summary>
public sealed class LoanRecorder(AppDbContext db, LocalCalendar calendar)
{
    public async Task<int> RecordDueAsync(CancellationToken cancellationToken)
    {
        var today = calendar.Today();
        var loans = await db.Loans.Where(l => l.AutoRecord && l.ClosedOn == null && l.FirstDueDate <= today).ToListAsync(cancellationToken);
        var recorded = 0;
        foreach (var userLoans in loans.GroupBy(l => l.UserId))
        {
            foreach (var loan in userLoans)
            {
                for (var i = 0; i < LoanRules.MaxCatchUp; i++)
                {
                    var state = (await LoanRules.StatesAsync(db, loan.UserId, [loan], cancellationToken))[loan.Id];
                    if (state.NextInstalment is not { } next || LoanRules.DueDateOf(loan, next.Number) > today)
                    {
                        break;
                    }

                    // A paying wallet that was deleted or archived stops it: the EMI waits in the due list.
                    if (!await db.Wallets.AnyAsync(w => w.Id == loan.PayFromWalletId && !w.Archived, cancellationToken))
                    {
                        break;
                    }

                    var at = calendar.StartOf(LoanRules.DueDateOf(loan, next.Number)) + TimeSpan.FromHours(9);
                    var (rows, _) = await LoanRules.AddEmiAsync(db, loan, state, loan.PayFromWalletId, null, 0, at, cancellationToken);
                    if (rows is null)
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
        }

        return recorded;
    }
}

public sealed class LoanOptions
{
    public const string Section = "Loans";

    /// <summary>Whether the background worker runs. Tests turn it off and call the recorder directly.</summary>
    public bool Enabled { get; set; } = true;

    public int PollMinutes { get; set; } = 30;
}

public sealed class LoanWorker(IServiceScopeFactory scopes, IOptions<LoanOptions> options, ILogger<LoanWorker> logger) : BackgroundService
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
                var recorded = await scope.ServiceProvider.GetRequiredService<LoanRecorder>().RecordDueAsync(stoppingToken);
                if (recorded > 0)
                {
                    logger.LogInformation("Recorded {Count} loan EMIs", recorded);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Recording loan EMIs failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
