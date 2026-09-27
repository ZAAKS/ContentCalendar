namespace ContentCalendar.Core.Services;

/// <summary>
/// Resolves client-supplied time zone ids (IANA or Windows) without ever throwing.
/// </summary>
public static class TimeZoneResolver
{
    public static TimeZoneInfo Resolve(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return TimeZoneInfo.Utc;
        }

        var id = timeZoneId.Trim();

        if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out TimeZoneInfo? zone))
        {
            return zone;
        }

        if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id, out var windowsId)
            && TimeZoneInfo.TryFindSystemTimeZoneById(windowsId, out zone))
        {
            return zone;
        }

        if (TimeZoneInfo.TryConvertWindowsIdToIanaId(id, out var ianaId)
            && TimeZoneInfo.TryFindSystemTimeZoneById(ianaId, out zone))
        {
            return zone;
        }

        return TimeZoneInfo.Utc;
    }
}
