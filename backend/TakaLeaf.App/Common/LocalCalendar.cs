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

    /// <summary>The local date and time of a moment.</summary>
    public DateTime ToLocal(DateTimeOffset moment) => TimeZoneInfo.ConvertTime(moment, zone).DateTime;

    /// <summary>The local day a moment falls on.</summary>
    public DateOnly DateOf(DateTimeOffset moment) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(moment, zone).DateTime);

    public DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), zone).DateTime);
}
