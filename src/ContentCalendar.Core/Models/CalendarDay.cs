namespace ContentCalendar.Core.Models;

/// <summary>
/// All calendar entries for a single local calendar day.
/// </summary>
public sealed record CalendarDay(DateOnly Date, IReadOnlyList<CalendarEntry> Entries)
{
    public int CreatedCount => Entries.Count(e => e.Kind == CalendarEntryKind.Created);

    public int ScheduledCount => Entries.Count(e => e.Kind == CalendarEntryKind.ScheduledPublish);

    public int DeletedCount => Entries.Count(e => e.Kind == CalendarEntryKind.Deleted);

    public int ScheduledUnpublishCount => Entries.Count(e => e.Kind == CalendarEntryKind.ScheduledUnpublish);
}
