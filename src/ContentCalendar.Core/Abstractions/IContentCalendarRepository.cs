using ContentCalendar.Core.Models;

namespace ContentCalendar.Core.Abstractions;

/// <summary>
/// Edition-specific, narrow read path into Umbraco's persistence layer.
/// Implementations must:
/// <list type="bullet">
///   <item>select only the columns needed to build <see cref="CalendarEntry"/> (no full content hydration);</item>
///   <item>restrict results to content the <paramref name="user"/> may browse (start nodes and granular permissions);</item>
///   <item>return entries in ascending <see cref="CalendarEntry.DateUtc"/> order, at most <c>maxResults</c> of them;</item>
///   <item>when a <c>parentKey</c> is given, return only direct children of that document (for trashed documents:
///   those whose parent was that document when they were trashed).</item>
/// </list>
/// </summary>
public interface IContentCalendarRepository
{
    /// <summary>Documents created inside <paramref name="window"/>.</summary>
    Task<IReadOnlyList<CalendarEntry>> GetCreatedAsync(
        UtcDateWindow window,
        CalendarUser user,
        Guid? parentKey,
        int maxResults,
        CancellationToken cancellationToken = default);

    /// <summary>Pending scheduled publishes (per culture where applicable) inside <paramref name="window"/>.</summary>
    Task<IReadOnlyList<CalendarEntry>> GetScheduledAsync(
        UtcDateWindow window,
        CalendarUser user,
        Guid? parentKey,
        int maxResults,
        CancellationToken cancellationToken = default);

    /// <summary>Pending scheduled unpublishes (per culture where applicable) inside <paramref name="window"/>.</summary>
    Task<IReadOnlyList<CalendarEntry>> GetScheduledUnpublishAsync(
        UtcDateWindow window,
        CalendarUser user,
        Guid? parentKey,
        int maxResults,
        CancellationToken cancellationToken = default);

    /// <summary>Documents currently in the recycle bin that were trashed inside <paramref name="window"/>.</summary>
    Task<IReadOnlyList<CalendarEntry>> GetDeletedAsync(
        UtcDateWindow window,
        CalendarUser user,
        Guid? parentKey,
        int maxResults,
        CancellationToken cancellationToken = default);
}
