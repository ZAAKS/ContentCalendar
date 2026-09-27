using System.ComponentModel.DataAnnotations;

namespace ContentCalendar.V17.Models;

/// <summary>Why an entry appears on the calendar.</summary>
public enum ContentCalendarEntryKindModel
{
    Created,
    ScheduledPublish,
    Deleted,
    ScheduledUnpublish,
}

/// <summary>Minimal document type info needed to render an entry.</summary>
public sealed class ContentCalendarDocumentTypeModel
{
    [Required]
    public required string Alias { get; init; }

    [Required]
    public required string Name { get; init; }

    [Required]
    public required string Icon { get; init; }
}

/// <summary>A single calendar entry.</summary>
public sealed class ContentCalendarEntryModel
{
    /// <summary>The document key (use to build the backoffice edit path).</summary>
    [Required]
    public required Guid Id { get; init; }

    [Required]
    public required string Name { get; init; }

    [Required]
    public required ContentCalendarDocumentTypeModel DocumentType { get; init; }

    /// <summary>Culture ISO code for variant schedules; <c>null</c> for invariant / node-level entries.</summary>
    public string? Culture { get; init; }

    /// <summary>The relevant date in UTC (ISO 8601).</summary>
    [Required]
    public required DateTimeOffset Date { get; init; }

    [Required]
    public required ContentCalendarEntryKindModel Kind { get; init; }

    /// <summary>Whether the document currently has a published version. Only meaningful for <c>Created</c> entries (always <c>false</c> otherwise).</summary>
    [Required]
    public required bool IsPublished { get; init; }
}

/// <summary>All entries for one local day.</summary>
public sealed class ContentCalendarDayModel
{
    /// <summary>Local calendar date in <c>yyyy-MM-dd</c> format (in the requested time zone).</summary>
    [Required]
    public required string Date { get; init; }

    [Required]
    public required int CreatedCount { get; init; }

    [Required]
    public required int ScheduledCount { get; init; }

    /// <summary>Pending scheduled unpublishes ("Unpublish at") on this day.</summary>
    [Required]
    public required int ScheduledUnpublishCount { get; init; }

    /// <summary>Documents moved to the recycle bin on this day.</summary>
    [Required]
    public required int DeletedCount { get; init; }

    [Required]
    public required IReadOnlyList<ContentCalendarEntryModel> Entries { get; init; }
}

/// <summary>One month of calendar data, grouped by local day on the server.</summary>
public sealed class ContentCalendarMonthResponseModel
{
    [Required]
    public required int Year { get; init; }

    [Required]
    public required int Month { get; init; }

    /// <summary>The <c>yyyy-MM</c> cache key for this month.</summary>
    [Required]
    public required string MonthKey { get; init; }

    /// <summary>The time zone the days were bucketed in (UTC when the requested zone was unknown).</summary>
    [Required]
    public required string TimeZone { get; init; }

    [Required]
    public required int TotalCreated { get; init; }

    [Required]
    public required int TotalScheduled { get; init; }

    [Required]
    public required int TotalScheduledUnpublish { get; init; }

    [Required]
    public required int TotalDeleted { get; init; }

    /// <summary><c>true</c> when the server-side safety limit was hit and some entries were omitted.</summary>
    [Required]
    public required bool IsTruncated { get; init; }

    /// <summary>Only days that have entries, ascending.</summary>
    [Required]
    public required IReadOnlyList<ContentCalendarDayModel> Days { get; init; }
}
