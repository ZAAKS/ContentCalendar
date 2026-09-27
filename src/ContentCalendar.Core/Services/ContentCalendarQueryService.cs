using ContentCalendar.Core.Abstractions;
using ContentCalendar.Core.Models;

namespace ContentCalendar.Core.Services;

/// <summary>
/// Composes the created + scheduled (publish/unpublish) + deleted repository reads for a single month (optionally only the children of one document) and buckets them by the viewer's local day.
/// Has no knowledge of how data is fetched - that is the edition-specific repository's job.
/// </summary>
public sealed class ContentCalendarQueryService : IContentCalendarQueryService
{
    private readonly IContentCalendarRepository _repository;
    private readonly ContentCalendarOptions _options;

    public ContentCalendarQueryService(IContentCalendarRepository repository, ContentCalendarOptions options)
    {
        _repository = repository;
        _options = options;
    }

    public async Task<CalendarMonth> GetMonthAsync(
        MonthRange range,
        CalendarUser user,
        string? timeZoneId,
        Guid? parentKey = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(range);
        ArgumentNullException.ThrowIfNull(user);

        TimeZoneInfo timeZone = TimeZoneResolver.Resolve(timeZoneId);
        UtcDateWindow window = range.ToUtcWindow(timeZone);
        var limit = Math.Max(1, _options.MaxEntriesPerKind);

        // Ask for one extra row so we can tell "exactly at the limit" apart from "truncated".
        // Sequential on purpose: repositories use ambient database scopes, which are not safe to run in parallel.
        IReadOnlyList<CalendarEntry> created = await _repository.GetCreatedAsync(window, user, parentKey, limit + 1, cancellationToken);
        IReadOnlyList<CalendarEntry> scheduled = await _repository.GetScheduledAsync(window, user, parentKey, limit + 1, cancellationToken);
        IReadOnlyList<CalendarEntry> unpublish = _options.ShowScheduledUnpublish
            ? await _repository.GetScheduledUnpublishAsync(window, user, parentKey, limit + 1, cancellationToken)
            : [];
        IReadOnlyList<CalendarEntry> deleted = _options.ShowDeleted
            ? await _repository.GetDeletedAsync(window, user, parentKey, limit + 1, cancellationToken)
            : [];

        var truncated = created.Count > limit || scheduled.Count > limit || unpublish.Count > limit || deleted.Count > limit;

        IEnumerable<CalendarEntry> merged = created.Take(limit)
            .Concat(scheduled.Take(limit))
            .Concat(unpublish.Take(limit))
            .Concat(deleted.Take(limit))
            .Where(e => window.Contains(EnsureUtc(e.DateUtc)))
            .Select(e => e with { DateUtc = EnsureUtc(e.DateUtc) });

        var days = merged
            .GroupBy(e => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(e.DateUtc, timeZone)))
            .OrderBy(g => g.Key)
            .Select(g => new CalendarDay(
                g.Key,
                g.OrderBy(e => e.DateUtc)
                    .ThenBy(e => e.Kind)
                    .ThenBy(e => e.Name, StringComparer.CurrentCultureIgnoreCase)
                    .ThenBy(e => e.Culture, StringComparer.OrdinalIgnoreCase)
                    .ToArray()))
            .ToArray();

        return new CalendarMonth(range, timeZone.Id, days, truncated);
    }

    private static DateTime EnsureUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}
