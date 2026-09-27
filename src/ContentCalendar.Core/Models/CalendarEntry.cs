namespace ContentCalendar.Core.Models;

/// <summary>
/// A single, narrow calendar row: just the fields the calendar renders, never a full content graph.
/// </summary>
/// <param name="Key">The content node key (GUID) - used to build the backoffice edit URL.</param>
/// <param name="Id">The content node integer id.</param>
/// <param name="Name">The node name (culture-specific name for scheduled variant entries, where available).</param>
/// <param name="ContentTypeAlias">The document type alias.</param>
/// <param name="ContentTypeName">The document type display name.</param>
/// <param name="ContentTypeIcon">The document type icon (for example <c>icon-document color-blue</c>).</param>
/// <param name="Culture">The culture (ISO code) the entry applies to, or <c>null</c> for invariant/node-level entries.</param>
/// <param name="DateUtc">The relevant date, always in UTC.</param>
/// <param name="Kind">Why the entry is on the calendar (created, scheduled publish/unpublish or deleted).</param>
/// <param name="IsPublished">Whether the node currently has a published version (in any culture). Only populated for created entries.</param>
public sealed record CalendarEntry(
    Guid Key,
    int Id,
    string Name,
    string ContentTypeAlias,
    string ContentTypeName,
    string ContentTypeIcon,
    string? Culture,
    DateTime DateUtc,
    CalendarEntryKind Kind,
    bool IsPublished = false);
