using Microsoft.Extensions.Options;

namespace TakaLeaf.App.Common.Outbox;

/// <summary>Runs the outbox: right after a request writes a message, and every PollSeconds for retries.</summary>
public sealed class OutboxWorker(IServiceScopeFactory scopes, OutboxSignal signal, IOptions<OutboxOptions> options, TimeProvider clock, ILogger<OutboxWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            return;
        }

        var poll = TimeSpan.FromSeconds(Math.Max(1, options.Value.PollSeconds));
        var nextCleanUp = DateTimeOffset.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            var taken = 0;
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var processor = scope.ServiceProvider.GetRequiredService<OutboxProcessor>();
                taken = await processor.ProcessDueAsync(stoppingToken);
                if (clock.GetUtcNow() >= nextCleanUp)
                {
                    await processor.CleanUpAsync(stoppingToken);
                    nextCleanUp = clock.GetUtcNow().AddHours(1);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The database may be down for a moment; the messages are still there next time.
                logger.LogError(exception, "Processing the outbox failed");
            }

            // A full batch means more may be waiting: go again at once.
            if (taken < Math.Max(1, options.Value.BatchSize))
            {
                await signal.WaitAsync(poll, stoppingToken);
            }
        }
    }
}
