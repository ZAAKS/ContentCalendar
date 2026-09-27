using ContentCalendar.Core.Models;

namespace ContentCalendar.Core.Abstractions;

/// <summary>
/// Application-facing calendar query: one month, grouped by local day.
/// </summary>
public interface IContentCalendarQueryService
{
    /// <param name="range">The month to load.</param>
    /// <param name="user">The backoffice user the request runs on behalf of.</param>
    /// <param name="timeZoneId">
    /// IANA (e.g. <c>Europe/Copenhagen</c>) or Windows time zone id of the viewer. Falls back to UTC when
    /// missing or unknown.
    /// </param>
    /// <param name="parentKey">
    /// When set, only the direct children of this document are returned (e.g. for a collection view of its children).
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<CalendarMonth> GetMonthAsync(
        MonthRange range,
        CalendarUser user,
        string? timeZoneId,
        Guid? parentKey = null,
        CancellationToken cancellationToken = default);
}
