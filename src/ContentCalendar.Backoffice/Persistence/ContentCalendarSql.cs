using System.Text;
using ContentCalendar.Core.Models;
using NPoco;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Infrastructure.Persistence;
using Umbraco.Cms.Infrastructure.Persistence.SqlSyntax;
using Umbraco.Extensions;
using Tables = Umbraco.Cms.Core.Constants.DatabaseSchema.Tables;

namespace ContentCalendar.Backoffice.Persistence;

/// <summary>
/// Builds the narrow, projection-only calendar queries against the Umbraco 17 and 18 schema.
/// </summary>
/// <remarks>
/// Schema verified against Umbraco-CMS <c>release-17.7.0</c> and <c>release-18.2.0</c>
/// (<c>src/Umbraco.Infrastructure/Persistence/Dtos</c>); the columns used here are identical in both.
/// Umbraco 18's Elements live under their own node object type, so the Document filters exclude them.
/// <list type="bullet">
///   <item><c>umbracoNode</c>: id, uniqueId, text, path, trashed, nodeObjectType, createDate (UTC since v17).</item>
///   <item><c>umbracoContent</c>: nodeId, contentTypeId.</item>
///   <item><c>umbracoDocument</c>: nodeId, published (true when any culture has a published version).</item>
///   <item><c>cmsContentType</c>: nodeId, alias, icon (name lives on the content type's own umbracoNode row).</item>
///   <item><c>umbracoContentSchedule</c>: nodeId, languageId (null = invariant), date (UTC), action ('Release' | 'Expire').</item>
///   <item><c>umbracoDocumentCultureVariation</c>: nodeId, languageId, name.</item>
///   <item><c>umbracoLanguage</c>: id, languageISOCode.</item>
///   <item><c>umbracoRelation</c>: parentId, childId, relType, datetime (UTC); <c>umbracoRelationType</c>: id, alias.</item>
/// </list>
/// Index usage: the created query filters on (nodeObjectType, trashed) which is served by
/// <c>IX_umbracoNode_ObjectType</c>, whose INCLUDE list already covers createDate/path/text/uniqueId,
/// so no extra index is required. <c>umbracoContentSchedule</c> only holds <i>pending</i> schedules
/// (Umbraco deletes rows once they run), so it stays small and needs no index.
/// </remarks>
internal static class ContentCalendarSql
{
    public static Sql<ISqlContext> Created(ISqlContext sqlContext, UtcDateWindow window, ContentAccessScope access, int? parentId, int maxResults)
    {
        var q = new Quoter(sqlContext.SqlSyntax);
        var args = new List<object>();
        string Arg(object value)
        {
            args.Add(value);
            return "@" + (args.Count - 1);
        }

        var sb = new StringBuilder();
        sb.Append("SELECT ")
            .Append($"n.{q.C("id")} AS NodeId, ")
            .Append($"n.{q.C(Constants.DatabaseSchema.Columns.UniqueIdName)} AS NodeKey, ")
            .Append($"n.{q.C("text")} AS Name, ")
            .Append($"n.{q.C("createDate")} AS EntryDate, ")
            .Append($"ct.{q.C("alias")} AS ContentTypeAlias, ")
            .Append($"ct.{q.C("icon")} AS ContentTypeIcon, ")
            .Append($"ctn.{q.C("text")} AS ContentTypeName, ")
            // CASE yields a plain integer on every provider (SQL Server bit / SQLite integer).
            .Append($"CASE WHEN d.{q.C("published")} = {Arg(true)} THEN 1 ELSE 0 END AS IsPublished ");
        AppendContentJoins(sb, q, q.T(Tables.Node) + " n");
        sb.Append($"LEFT JOIN {q.T(Tables.Document)} d ON d.{q.C("nodeId")} = n.{q.C("id")} ")
            .Append($"WHERE n.{q.C("nodeObjectType")} = {Arg(Constants.ObjectTypes.Document)} ")
            .Append($"AND n.{q.C("trashed")} = {Arg(false)} ")
            .Append($"AND n.{q.C("createDate")} >= {Arg(window.StartUtc)} ")
            .Append($"AND n.{q.C("createDate")} < {Arg(window.EndUtcExclusive)} ");
        AppendPathFilter(sb, q, access, Arg);
        AppendParentFilter(sb, $"n.{q.C("parentId")}", parentId, Arg);
        sb.Append($"ORDER BY n.{q.C("createDate")}, n.{q.C("id")}");

        return sqlContext.Sql(sb.ToString(), args.ToArray()).SelectTop(maxResults);
    }

    public static Sql<ISqlContext> Scheduled(ISqlContext sqlContext, UtcDateWindow window, ContentAccessScope access, ContentScheduleAction action, int? parentId, int maxResults)
    {
        var q = new Quoter(sqlContext.SqlSyntax);
        var args = new List<object>();
        string Arg(object value)
        {
            args.Add(value);
            return "@" + (args.Count - 1);
        }

        var sb = new StringBuilder();
        sb.Append("SELECT ")
            .Append($"n.{q.C("id")} AS NodeId, ")
            .Append($"n.{q.C(Constants.DatabaseSchema.Columns.UniqueIdName)} AS NodeKey, ")
            .Append($"COALESCE(dcv.{q.C("name")}, n.{q.C("text")}) AS Name, ")
            .Append($"cs.{q.C("date")} AS EntryDate, ")
            .Append($"l.{q.C("languageISOCode")} AS Culture, ")
            .Append($"ct.{q.C("alias")} AS ContentTypeAlias, ")
            .Append($"ct.{q.C("icon")} AS ContentTypeIcon, ")
            .Append($"ctn.{q.C("text")} AS ContentTypeName ")
            .Append($"FROM {q.T(Tables.ContentSchedule)} cs ")
            .Append($"INNER JOIN {q.T(Tables.Node)} n ON n.{q.C("id")} = cs.{q.C("nodeId")} ");
        AppendContentJoins(sb, q, from: null);
        sb.Append($"LEFT JOIN {q.T(Tables.Language)} l ON l.{q.C("id")} = cs.{q.C("languageId")} ")
            .Append($"LEFT JOIN {q.T(Tables.DocumentCultureVariation)} dcv ON dcv.{q.C("nodeId")} = cs.{q.C("nodeId")} AND dcv.{q.C("languageId")} = cs.{q.C("languageId")} ")
            .Append($"WHERE cs.{q.C("action")} = {Arg(action.ToString())} ")
            .Append($"AND cs.{q.C("date")} >= {Arg(window.StartUtc)} ")
            .Append($"AND cs.{q.C("date")} < {Arg(window.EndUtcExclusive)} ")
            .Append($"AND n.{q.C("nodeObjectType")} = {Arg(Constants.ObjectTypes.Document)} ")
            .Append($"AND n.{q.C("trashed")} = {Arg(false)} ");
        AppendPathFilter(sb, q, access, Arg);
        AppendParentFilter(sb, $"n.{q.C("parentId")}", parentId, Arg);
        sb.Append($"ORDER BY cs.{q.C("date")}, n.{q.C("id")}");

        return sqlContext.Sql(sb.ToString(), args.ToArray()).SelectTop(maxResults);
    }

    /// <summary>
    /// Documents in the recycle bin, dated by core's "relate parent document on delete" relation, which
    /// <c>RelateOnTrashNotificationHandler</c> writes (UTC <c>datetime</c>) when a document is trashed and removes on restore.
    /// </summary>
    /// <remarks>
    /// Callers must only run this for users with root access: core only lets those users into the recycle bin,
    /// and trashed paths (<c>-1,-20,…</c>) never match a start-node path filter anyway.
    /// </remarks>
    public static Sql<ISqlContext> Deleted(ISqlContext sqlContext, UtcDateWindow window, int? parentId, int maxResults)
    {
        var q = new Quoter(sqlContext.SqlSyntax);
        var args = new List<object>();
        string Arg(object value)
        {
            args.Add(value);
            return "@" + (args.Count - 1);
        }

        var trashedAt = $"MAX(r.{q.C("datetime")})";
        var sb = new StringBuilder();
        sb.Append("SELECT ")
            .Append($"n.{q.C("id")} AS NodeId, ")
            .Append($"n.{q.C(Constants.DatabaseSchema.Columns.UniqueIdName)} AS NodeKey, ")
            .Append($"n.{q.C("text")} AS Name, ")
            .Append($"{trashedAt} AS EntryDate, ")
            .Append($"ct.{q.C("alias")} AS ContentTypeAlias, ")
            .Append($"ct.{q.C("icon")} AS ContentTypeIcon, ")
            .Append($"ctn.{q.C("text")} AS ContentTypeName ")
            .Append($"FROM {q.T(Tables.Relation)} r ")
            .Append($"INNER JOIN {q.T(Tables.RelationType)} rt ON rt.{q.C("id")} = r.{q.C("relType")} ")
            .Append($"INNER JOIN {q.T(Tables.Node)} n ON n.{q.C("id")} = r.{q.C("childId")} ");
        AppendContentJoins(sb, q, from: null);
        sb.Append($"WHERE rt.{q.C("alias")} = {Arg(Constants.Conventions.RelationTypes.RelateParentDocumentOnDeleteAlias)} ")
            .Append($"AND n.{q.C("nodeObjectType")} = {Arg(Constants.ObjectTypes.Document)} ")
            .Append($"AND n.{q.C("trashed")} = {Arg(true)} ");
        // A trashed document's own parentId is the recycle bin; the relation keeps the parent it was trashed from.
        AppendParentFilter(sb, $"r.{q.C("parentId")}", parentId, Arg);
        sb.Append($"GROUP BY n.{q.C("id")}, n.{q.C(Constants.DatabaseSchema.Columns.UniqueIdName)}, n.{q.C("text")}, ")
            .Append($"ct.{q.C("alias")}, ct.{q.C("icon")}, ctn.{q.C("text")} ")
            .Append($"HAVING {trashedAt} >= {Arg(window.StartUtc)} AND {trashedAt} < {Arg(window.EndUtcExclusive)} ")
            .Append($"ORDER BY {trashedAt}, n.{q.C("id")}");

        return sqlContext.Sql(sb.ToString(), args.ToArray()).SelectTop(maxResults);
    }

    private static void AppendContentJoins(StringBuilder sb, Quoter q, string? from)
    {
        if (from is not null)
        {
            sb.Append($"FROM {from} ");
        }

        sb.Append($"INNER JOIN {q.T(Tables.Content)} c ON c.{q.C("nodeId")} = n.{q.C("id")} ")
            .Append($"INNER JOIN {q.T(Tables.ContentType)} ct ON ct.{q.C("nodeId")} = c.{q.C("contentTypeId")} ")
            .Append($"INNER JOIN {q.T(Tables.Node)} ctn ON ctn.{q.C("id")} = ct.{q.C("nodeId")} ");
    }

    /// <summary>Limits rows to the direct children of one document (collection views).</summary>
    private static void AppendParentFilter(StringBuilder sb, string parentIdColumn, int? parentId, Func<object, string> arg)
    {
        if (parentId is null)
        {
            return;
        }

        sb.Append($"AND {parentIdColumn} = {arg(parentId.Value)} ");
    }

    /// <summary>
    /// Pushes the user's start-node restriction into SQL so rows outside their branch are never read.
    /// </summary>
    private static void AppendPathFilter(StringBuilder sb, Quoter q, ContentAccessScope access, Func<object, string> arg)
    {
        if (access.IsRestricted is false)
        {
            return;
        }

        var path = $"n.{q.C("path")}";
        IEnumerable<string> clauses = access.StartNodePaths.Select(p => $"{path} = {arg(p)} OR {path} LIKE {arg(p + ",%")}");
        sb.Append("AND (").Append(string.Join(" OR ", clauses)).Append(") ");
    }

    private readonly struct Quoter(ISqlSyntaxProvider syntax)
    {
        public string T(string table) => syntax.GetQuotedTableName(table);

        public string C(string column) => syntax.GetQuotedColumnName(column);
    }
}
