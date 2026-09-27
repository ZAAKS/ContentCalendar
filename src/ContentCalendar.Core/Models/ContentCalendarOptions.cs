namespace ContentCalendar.Core.Models;

/// <summary>
/// Server-side options, bound from the <c>ContentCalendar</c> configuration section.
/// </summary>
public sealed class ContentCalendarOptions
{
    public const string SectionName = "ContentCalendar";

    /// <summary>
    /// Safety cap on how many entries of each kind (created / scheduled publish / scheduled unpublish / deleted)
    /// a single month request may return.
    /// Protects the backoffice from bulk imports that create tens of thousands of nodes in one month.
    /// </summary>
    public int MaxEntriesPerKind { get; set; } = 2000;

    /// <summary>
    /// Show documents that are in the recycle bin on the date they were trashed.
    /// Only users with access to the content root can see them, the same rule as core's recycle bin.
    /// </summary>
    public bool ShowDeleted { get; set; } = true;

    /// <summary>Show pending scheduled unpublishes ("Unpublish at") on their scheduled date.</summary>
    public bool ShowScheduledUnpublish { get; set; } = true;
}
