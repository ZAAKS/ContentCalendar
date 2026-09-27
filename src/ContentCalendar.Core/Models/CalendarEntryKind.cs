namespace ContentCalendar.Core.Models;

/// <summary>
/// Why a content item appears on the calendar on a given date.
/// </summary>
public enum CalendarEntryKind
{
    /// <summary>The content node was created on this date.</summary>
    Created = 0,

    /// <summary>The content node (or one of its culture variants) is scheduled to be published on this date.</summary>
    ScheduledPublish = 1,

    /// <summary>
    /// The content node was moved to the recycle bin on this date. Trashed nodes are shown only on this date,
    /// never on their created date.
    /// </summary>
    Deleted = 2,

    /// <summary>The content node (or one of its culture variants) is scheduled to be unpublished on this date.</summary>
    ScheduledUnpublish = 3,
}
