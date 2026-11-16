using Microsoft.EntityFrameworkCore;
using TakaLeaf.App.Common;
using TakaLeaf.App.Data;
using TakaLeaf.App.Data.Entities;
using TakaLeaf.App.Features.Transactions;

namespace TakaLeaf.App.Features.Recurring;

public sealed record RecurringDto(
    Guid Id,
    TransactionType Type,
    long Amount,
    Guid? FromWalletId,
    string? FromWalletName,
    Guid? ToWalletId,
    string? ToWalletName,
    Guid? CategoryId,
    string? CategoryName,
    string? Note,
    RecurringFrequency Frequency,
    int Interval,
    DateOnly StartDate,
    DateOnly? EndDate,
    DateOnly? NextDate,
    int DueCount,
    bool AutoRecord,
    bool Paused);

/// <summary>Adding and editing take the same fields. The wallets and category follow the transaction rules.</summary>
public sealed record RecurringRequest(
    TransactionType? Type,
    long? Amount,
    Guid? FromWalletId,
    Guid? ToWalletId,
    Guid? CategoryId,
    string? Note,
    RecurringFrequency? Frequency,
    int? Interval,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool? AutoRecord);

/// <summary>Recording a due date can change the amount (a bill that varies) or the time.</summary>
public sealed record RecordRequest(long? Amount, DateTimeOffset? OccurredAt);

internal static class RecurringRules
{
    public const int MaxInterval = 366;

    /// <summary>A due date is recorded at 9 in the morning, local time, unless the user says otherwise.</summary>
    public static readonly TimeSpan RecordTimeOfDay = TimeSpan.FromHours(9);

    /// <summary>Never walk more dates than this in one go, so a bad rule cannot run away.</summary>
    public const int MaxCatchUp = 400;

    /// <summary>The n-th date (0 = the start). Monthly and yearly keep the start's day where the month has it.</summary>
    public static DateOnly DateFor(RecurringFrequency frequency, int interval, DateOnly start, int n) => frequency switch
    {
        RecurringFrequency.Daily => start.AddDays(n * interval),
        RecurringFrequency.Weekly => start.AddDays(n * interval * 7),
        RecurringFrequency.Monthly => start.AddMonths(n * interval),
        _ => start.AddYears(n * interval),
    };

    public static bool Ended(RecurringRule rule) => rule.EndDate is { } end && rule.NextDate > end;

    /// <summary>Moves the rule on to its next date.</summary>
    public static void Advance(RecurringRule rule)
    {
        rule.Occurrences++;
        rule.NextDate = DateFor(rule.Frequency, rule.Interval, rule.StartDate, rule.Occurrences);
    }

    /// <summary>How many dates are due up to today (0 when paused or ended), counting at most 99.</summary>
    public static int DueCount(RecurringRule rule, DateOnly today)
    {
        if (rule.Paused)
        {
            return 0;
        }

        var count = 0;
        var n = rule.Occurrences;
        var date = rule.NextDate;
        while (date <= today && (rule.EndDate is null || date <= rule.EndDate) && count < 99)
        {
            count++;
            n++;
            date = DateFor(rule.Frequency, rule.Interval, rule.StartDate, n);
        }

        return count;
    }

    /// <summary>
    /// Checks the money fields with the same rules as a transaction. When editing, the rule's own
    /// wallets and category may stay even if archived since.
    /// </summary>
    public static async Task<IResult?> CheckAsync(
        AppDbContext db, Guid userId, RecurringRequest request, RecurringRule? existing, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var current = existing is null ? null : AsTransaction(existing);
        var transaction = new TransactionRequest(request.Type, request.Amount, request.FromWalletId, request.ToWalletId, request.CategoryId, now, request.Note, null, null);
        var (_, problem) = await TransactionRules.CheckAsync(db, userId, transaction, current, null, now, cancellationToken);
        if (problem is not null)
        {
            return problem;
        }

        if (request.Frequency is not { } frequency || !Enum.IsDefined(frequency))
        {
            return ValidationErrors.For("frequency", "Choose Daily, Weekly, Monthly or Yearly.");
        }

        if (request.Interval is { } interval && (interval < 1 || interval > MaxInterval))
        {
            return ValidationErrors.For("interval", $"Repeat every 1 to {MaxInterval}.");
        }

        if (request.StartDate is not { } start)
        {
            return ValidationErrors.For("startDate", "Choose the first date.");
        }

        if (request.EndDate is { } end && end < start)
        {
            return ValidationErrors.For("endDate", "The last date must be on or after the first.");
        }

        return null;
    }

    /// <summary>The rule's money fields as a transaction, for checks and for recording.</summary>
    public static Transaction AsTransaction(RecurringRule rule) => new()
    {
        UserId = rule.UserId,
        Type = rule.Type,
        Amount = rule.Amount,
        FromWalletId = rule.FromWalletId,
        ToWalletId = rule.ToWalletId,
        CategoryId = rule.CategoryId,
        Note = rule.Note,
    };

    public static void Apply(RecurringRule rule, RecurringRequest request, bool isNew)
    {
        var frequency = request.Frequency!.Value;
        var interval = request.Interval ?? 1;
        var start = request.StartDate!.Value;
        var scheduleChanged = rule.Frequency != frequency || rule.Interval != interval || rule.StartDate != start;

        rule.Type = request.Type!.Value;
        rule.Amount = request.Amount!.Value;
        rule.FromWalletId = request.Type == TransactionType.Income ? null : request.FromWalletId;
        rule.ToWalletId = request.Type == TransactionType.Expense ? null : request.ToWalletId;
        rule.CategoryId = request.Type == TransactionType.Transfer ? null : request.CategoryId;
        rule.Note = Text.Clean(request.Note);
        rule.EndDate = request.EndDate;
        rule.AutoRecord = request.AutoRecord ?? false;

        if (isNew)
        {
            rule.Frequency = frequency;
            rule.Interval = interval;
            rule.StartDate = start;
            rule.Occurrences = 0;
            rule.NextDate = start;
            return;
        }

        if (scheduleChanged)
        {
            // Dates already recorded or skipped stay behind us: carry on from the first date of
            // the new schedule on or after where the old one had reached.
            var reached = rule.NextDate;
            rule.Frequency = frequency;
            rule.Interval = interval;
            rule.StartDate = start;
            var n = 0;
            while (DateFor(frequency, interval, start, n) < reached && n < 100_000)
            {
                n++;
            }

            rule.Occurrences = n;
            rule.NextDate = DateFor(frequency, interval, start, n);
        }
    }

    public static async Task<List<RecurringDto>> ToDtosAsync(
        AppDbContext db, Guid userId, IReadOnlyList<RecurringRule> rules, DateOnly today, CancellationToken cancellationToken)
    {
        var walletNames = await db.Wallets.IgnoreQueryFilters()
            .Where(w => w.UserId == userId)
            .ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);
        var categoryNames = await db.Categories.IgnoreQueryFilters()
            .Where(c => c.UserId == userId)
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);

        return rules.Select(r => new RecurringDto(
            r.Id, r.Type, r.Amount,
            r.FromWalletId, NameOf(walletNames, r.FromWalletId),
            r.ToWalletId, NameOf(walletNames, r.ToWalletId),
            r.CategoryId, NameOf(categoryNames, r.CategoryId),
            r.Note, r.Frequency, r.Interval, r.StartDate, r.EndDate,
            Ended(r) ? null : r.NextDate,
            DueCount(r, today),
            r.AutoRecord, r.Paused)).ToList();
    }

    private static string? NameOf(Dictionary<Guid, string> names, Guid? id) =>
        id is { } key && names.TryGetValue(key, out var name) ? name : null;
}
