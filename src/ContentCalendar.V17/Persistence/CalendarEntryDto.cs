namespace ContentCalendar.V17.Persistence;

/// <summary>
/// Flat projection row returned by the calendar SQL. Only the columns the calendar renders.
/// </summary>
internal sealed class CalendarEntryDto
{
    public int NodeId { get; set; }

    public Guid NodeKey { get; set; }

    public string? Name { get; set; }

    public DateTime EntryDate { get; set; }

    public string? Culture { get; set; }

    public string? ContentTypeAlias { get; set; }

    public string? ContentTypeName { get; set; }

    public string? ContentTypeIcon { get; set; }

    /// <summary>1 when the node has a published version; only selected by the created query (0 otherwise).</summary>
    public int IsPublished { get; set; }
}
