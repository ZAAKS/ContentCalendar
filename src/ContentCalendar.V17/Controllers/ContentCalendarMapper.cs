using System.Globalization;
using ContentCalendar.V17.Models;
using ContentCalendar.Core.Models;

namespace ContentCalendar.V17.Controllers;

internal static class ContentCalendarMapper
{
    public static ContentCalendarMonthResponseModel ToResponse(CalendarMonth month) => new()
    {
        Year = month.Range.Year,
        Month = month.Range.Month,
        MonthKey = month.Range.Key,
        TimeZone = month.TimeZoneId,
        TotalCreated = month.TotalCreated,
        TotalScheduled = month.TotalScheduled,
        TotalScheduledUnpublish = month.TotalScheduledUnpublish,
        TotalDeleted = month.TotalDeleted,
        IsTruncated = month.IsTruncated,
        Days = month.Days.Select(ToResponse).ToArray(),
    };

    private static ContentCalendarDayModel ToResponse(CalendarDay day) => new()
    {
        Date = day.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        CreatedCount = day.CreatedCount,
        ScheduledCount = day.ScheduledCount,
        ScheduledUnpublishCount = day.ScheduledUnpublishCount,
        DeletedCount = day.DeletedCount,
        Entries = day.Entries.Select(ToResponse).ToArray(),
    };

    private static ContentCalendarEntryModel ToResponse(CalendarEntry entry) => new()
    {
        Id = entry.Key,
        Name = entry.Name,
        DocumentType = new ContentCalendarDocumentTypeModel
        {
            Alias = entry.ContentTypeAlias,
            Name = entry.ContentTypeName,
            Icon = entry.ContentTypeIcon,
        },
        Culture = entry.Culture,
        Date = new DateTimeOffset(entry.DateUtc, TimeSpan.Zero),
        IsPublished = entry.IsPublished,
        Kind = entry.Kind switch
        {
            CalendarEntryKind.ScheduledPublish => ContentCalendarEntryKindModel.ScheduledPublish,
            CalendarEntryKind.ScheduledUnpublish => ContentCalendarEntryKindModel.ScheduledUnpublish,
            CalendarEntryKind.Deleted => ContentCalendarEntryKindModel.Deleted,
            _ => ContentCalendarEntryKindModel.Created,
        },
    };
}
