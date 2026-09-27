namespace ContentCalendar.Core.Models;

/// <summary>
/// One month of calendar data, already grouped by local day so clients can render it directly.
/// </summary>
/// <param name="Range">The requested month.</param>
/// <param name="TimeZoneId">The time zone the days were bucketed in.</param>
/// <param name="Days">Only days that have at least one entry, in ascending order.</param>
/// <param name="IsTruncated">
/// <c>true</c> when a safety limit (<see cref="ContentCalendarOptions.MaxEntriesPerKind"/>) was hit
/// and some entries were omitted.
/// </param>
public sealed record CalendarMonth(
    MonthRange Range,
    string TimeZoneId,
    IReadOnlyList<CalendarDay> Days,
    bool IsTruncated)
{
    public int TotalCreated => Days.Sum(d => d.CreatedCount);

    public int TotalScheduled => Days.Sum(d => d.ScheduledCount);

    public int TotalDeleted => Days.Sum(d => d.DeletedCount);

    public int TotalScheduledUnpublish => Days.Sum(d => d.ScheduledUnpublishCount);
}
