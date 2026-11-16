using Microsoft.Extensions.Options;

namespace TakaLeaf.App.Common;

/// <summary>
/// Times are stored in UTC; days and months are counted where the person lives (App:TimeZone,
/// Asia/Dhaka by default). 11:30 PM on 30 November in Dhaka belongs to November.
/// </summary>
public sealed class LocalCalendar(IOptions<AppOptions> options, TimeProvider clock)
{
    private readonly TimeZoneInfo zone = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZone);

    /// <summary>The moment the given local day begins, in UTC.</summary>
    public DateTimeOffset StartOf(DateOnly day)
    {
        var utc = TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue), zone);
        return new DateTimeOffset(utc, TimeSpan.Zero);
    }

    public DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), zone).DateTime);
}
