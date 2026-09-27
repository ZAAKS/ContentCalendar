namespace ContentCalendar.Core.Models;

/// <summary>
/// A calendar month. The calendar only ever asks for exactly one of these at a time.
/// </summary>
public sealed record MonthRange
{
    public MonthRange(int year, int month)
    {
        // DateTime supports years 1-9999; keep one month of head-room on either side for time zone offsets.
        if (year is < 2 or > 9998)
        {
            throw new ArgumentOutOfRangeException(nameof(year), year, "Year must be between 2 and 9998.");
        }

        if (month is < 1 or > 12)
        {
            throw new ArgumentOutOfRangeException(nameof(month), month, "Month must be between 1 and 12.");
        }

        Year = year;
        Month = month;
    }

    public int Year { get; }

    public int Month { get; }

    /// <summary>First day of the month (wall-clock, unspecified kind).</summary>
    public DateTime Start => new(Year, Month, 1, 0, 0, 0, DateTimeKind.Unspecified);

    /// <summary>First day of the following month (wall-clock, unspecified kind).</summary>
    public DateTime EndExclusive => Start.AddMonths(1);

    /// <summary>The <c>yyyy-MM</c> key used by clients to cache months.</summary>
    public string Key => $"{Year:D4}-{Month:D2}";

    /// <summary>
    /// Converts the wall-clock month in <paramref name="timeZone"/> to the equivalent UTC window
    /// that repositories query against (Umbraco 17 stores system dates in UTC).
    /// </summary>
    public UtcDateWindow ToUtcWindow(TimeZoneInfo timeZone)
    {
        ArgumentNullException.ThrowIfNull(timeZone);
        return new UtcDateWindow(ToUtc(Start, timeZone), ToUtc(EndExclusive, timeZone));
    }

    private static DateTime ToUtc(DateTime wallClock, TimeZoneInfo timeZone)
    {
        // Midnight can fall in a DST gap in a handful of zones; step forward until we hit a valid local time.
        var candidate = wallClock;
        while (timeZone.IsInvalidTime(candidate))
        {
            candidate = candidate.AddMinutes(15);
        }

        return TimeZoneInfo.ConvertTimeToUtc(candidate, timeZone);
    }
}
