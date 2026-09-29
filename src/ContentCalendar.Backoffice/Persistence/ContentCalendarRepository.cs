using ContentCalendar.Core.Abstractions;
using ContentCalendar.Core.Models;
using NPoco;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Actions;
using Umbraco.Cms.Core.Cache;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Persistence;
using Umbraco.Cms.Infrastructure.Scoping;
using Umbraco.Extensions;

namespace ContentCalendar.Backoffice.Persistence;

/// <summary>
/// Umbraco 17/18 implementation of <see cref="IContentCalendarRepository"/>.
/// Reads straight from the persistence layer with a projection-only query (never hydrates <c>IContent</c>),
/// pushes the user's start-node restriction into SQL, then applies Umbraco's own batched granular
/// "Browse" permission check to the (already small) result set.
/// </summary>
internal sealed class ContentCalendarRepository : IContentCalendarRepository
{
    // Keep well below SQL Server's 2100 parameter limit for the permission service's IN (...) queries.
    private const int PermissionBatchSize = 500;

    private static readonly ISet<string> BrowsePermission = new HashSet<string> { ActionBrowse.ActionLetter };

    private readonly IScopeProvider _scopeProvider;
    private readonly IUserService _userService;
    private readonly IEntityService _entityService;
    private readonly IContentPermissionService _contentPermissionService;
    private readonly AppCaches _appCaches;

    public ContentCalendarRepository(
        IScopeProvider scopeProvider,
        IUserService userService,
        IEntityService entityService,
        IContentPermissionService contentPermissionService,
        AppCaches appCaches)
    {
        _scopeProvider = scopeProvider;
        _userService = userService;
        _entityService = entityService;
        _contentPermissionService = contentPermissionService;
        _appCaches = appCaches;
    }

    public Task<IReadOnlyList<CalendarEntry>> GetCreatedAsync(
        UtcDateWindow window,
        CalendarUser user,
        Guid? parentKey,
        int maxResults,
        CancellationToken cancellationToken = default)
        => QueryAsync(
            user,
            parentKey,
            CalendarEntryKind.Created,
            (sqlContext, access, parentId) => ContentCalendarSql.Created(sqlContext, window, access, parentId, maxResults),
            cancellationToken);

    public Task<IReadOnlyList<CalendarEntry>> GetScheduledAsync(
        UtcDateWindow window,
        CalendarUser user,
        Guid? parentKey,
        int maxResults,
        CancellationToken cancellationToken = default)
        => QueryAsync(
            user,
            parentKey,
            CalendarEntryKind.ScheduledPublish,
            (sqlContext, access, parentId) => ContentCalendarSql.Scheduled(sqlContext, window, access, ContentScheduleAction.Release, parentId, maxResults),
            cancellationToken);

    public Task<IReadOnlyList<CalendarEntry>> GetScheduledUnpublishAsync(
        UtcDateWindow window,
        CalendarUser user,
        Guid? parentKey,
        int maxResults,
        CancellationToken cancellationToken = default)
        => QueryAsync(
            user,
            parentKey,
            CalendarEntryKind.ScheduledUnpublish,
            (sqlContext, access, parentId) => ContentCalendarSql.Scheduled(sqlContext, window, access, ContentScheduleAction.Expire, parentId, maxResults),
            cancellationToken);

    public Task<IReadOnlyList<CalendarEntry>> GetDeletedAsync(
        UtcDateWindow window,
        CalendarUser user,
        Guid? parentKey,
        int maxResults,
        CancellationToken cancellationToken = default)
        => QueryAsync(
            user,
            parentKey,
            CalendarEntryKind.Deleted,
            // Core only grants recycle bin access to users with root access (ContentPermissions.HasPathAccess).
            (sqlContext, access, parentId) => access.IsRestricted ? null : ContentCalendarSql.Deleted(sqlContext, window, parentId, maxResults),
            cancellationToken);

    private async Task<IReadOnlyList<CalendarEntry>> QueryAsync(
        CalendarUser user,
        Guid? parentKey,
        CalendarEntryKind kind,
        Func<ISqlContext, ContentAccessScope, int?, Sql<ISqlContext>?> buildSql,
        CancellationToken cancellationToken)
    {
        IUser? umbracoUser = await _userService.GetAsync(user.Key);
        if (umbracoUser is null)
        {
            return [];
        }

        ContentAccessScope access = ResolveAccess(umbracoUser);
        if (access.HasAccess is false)
        {
            return [];
        }

        int? parentId = null;
        if (parentKey is not null)
        {
            // An unknown (or non-document) parent has no children to show.
            Attempt<int> parent = _entityService.GetId(parentKey.Value, UmbracoObjectTypes.Document);
            if (parent.Success is false)
            {
                return [];
            }

            parentId = parent.Result;
        }

        List<CalendarEntryDto> rows;
        using (IScope scope = _scopeProvider.CreateScope(autoComplete: true))
        {
            Sql<ISqlContext>? sql = buildSql(scope.SqlContext, access, parentId);
            if (sql is null)
            {
                return [];
            }

            rows = await scope.Database.FetchAsync<CalendarEntryDto>(sql);
        }

        cancellationToken.ThrowIfCancellationRequested();

        if (rows.Count == 0)
        {
            return [];
        }

        ISet<Guid> browsable = await FilterBrowsableAsync(umbracoUser, rows.Select(r => r.NodeKey).Distinct());

        return rows
            .Where(r => browsable.Contains(r.NodeKey))
            .Select(r => new CalendarEntry(
                r.NodeKey,
                r.NodeId,
                r.Name ?? string.Empty,
                r.ContentTypeAlias ?? string.Empty,
                r.ContentTypeName ?? r.ContentTypeAlias ?? string.Empty,
                string.IsNullOrWhiteSpace(r.ContentTypeIcon) ? "icon-document" : r.ContentTypeIcon,
                string.IsNullOrWhiteSpace(r.Culture) ? null : r.Culture,
                DateTime.SpecifyKind(r.EntryDate, DateTimeKind.Utc),
                kind,
                r.IsPublished != 0))
            .ToArray();
    }

    private ContentAccessScope ResolveAccess(IUser user)
    {
        int[]? startNodeIds = user.CalculateContentStartNodeIds(_entityService, _appCaches);
        if (startNodeIds is null || startNodeIds.Length == 0)
        {
            return ContentAccessScope.None;
        }

        if (startNodeIds.Contains(Constants.System.Root))
        {
            return ContentAccessScope.Unrestricted;
        }

        // Paths only (id, key, path) - a single light query, no entity hydration.
        IReadOnlyList<string> paths = _entityService
            .GetAllPaths(UmbracoObjectTypes.Document, startNodeIds)
            .Select(p => p.Path)
            .Where(p => string.IsNullOrWhiteSpace(p) is false)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return ContentAccessScope.Restricted(paths);
    }

    private async Task<ISet<Guid>> FilterBrowsableAsync(IUser user, IEnumerable<Guid> keys)
    {
        var allowed = new HashSet<Guid>();
        foreach (Guid[] batch in keys.Chunk(PermissionBatchSize))
        {
            ISet<Guid> result = await _contentPermissionService.FilterAuthorizedAccessAsync(user, batch, BrowsePermission);
            allowed.UnionWith(result);
        }

        return allowed;
    }
}
