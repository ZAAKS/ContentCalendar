namespace ContentCalendar.V17.Persistence;

/// <summary>
/// The subset of the content tree a user may see, expressed so it can be pushed into SQL.
/// </summary>
internal sealed class ContentAccessScope
{
    private ContentAccessScope(bool hasAccess, IReadOnlyList<string> startNodePaths)
    {
        HasAccess = hasAccess;
        StartNodePaths = startNodePaths;
    }

    public static ContentAccessScope None { get; } = new(false, []);

    public static ContentAccessScope Unrestricted { get; } = new(true, []);

    public bool HasAccess { get; }

    /// <summary>
    /// Paths (e.g. <c>-1,1051,1060</c>) of the user's start nodes. Empty when the user has root access.
    /// </summary>
    public IReadOnlyList<string> StartNodePaths { get; }

    public bool IsRestricted => HasAccess && StartNodePaths.Count > 0;

    public static ContentAccessScope Restricted(IReadOnlyList<string> startNodePaths) =>
        startNodePaths.Count == 0 ? None : new ContentAccessScope(true, startNodePaths);
}
