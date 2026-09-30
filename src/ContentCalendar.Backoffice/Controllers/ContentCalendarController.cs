using System.ComponentModel.DataAnnotations;
using Asp.Versioning;
using ContentCalendar.Backoffice.Models;
using ContentCalendar.Core.Abstractions;
using ContentCalendar.Core.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Api.Common.Attributes;
using Umbraco.Cms.Api.Management.Controllers;
using Umbraco.Cms.Api.Management.Routing;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Security;
using Umbraco.Cms.Web.Common.Authorization;

namespace ContentCalendar.Backoffice.Controllers;

/// <summary>
/// Management API for the Content Calendar dashboard.
/// Route: <c>/umbraco/management/api/v1/content-calendar/...</c>.
/// </summary>
[ApiVersion("1.0")]
[VersionedApiBackOfficeRoute(ContentCalendarApiConstants.RouteSegment)]
[ApiExplorerSettings(GroupName = ContentCalendarApiConstants.GroupName)]
[MapToApi(ContentCalendarApiConstants.ApiName)]
[Authorize(Policy = AuthorizationPolicies.SectionAccessContent)]
public sealed class ContentCalendarController : ManagementApiControllerBase
{
    private readonly IContentCalendarQueryService _queryService;
    private readonly IBackOfficeSecurityAccessor _backOfficeSecurityAccessor;

    public ContentCalendarController(
        IContentCalendarQueryService queryService,
        IBackOfficeSecurityAccessor backOfficeSecurityAccessor)
    {
        _queryService = queryService;
        _backOfficeSecurityAccessor = backOfficeSecurityAccessor;
    }

    /// <summary>
    /// Gets everything created or scheduled to publish in a single month, grouped by local day.
    /// Only content the current user may browse is returned.
    /// </summary>
    /// <param name="year">Four-digit year.</param>
    /// <param name="month">Month number, 1-12.</param>
    /// <param name="timeZone">The viewer's IANA time zone (e.g. <c>Europe/Copenhagen</c>). Defaults to UTC.</param>
    /// <param name="parentKey">
    /// Optional document key. When set, only that document's direct children are returned (the calendar collection view).
    /// </param>
    /// <param name="cancellationToken">Request cancellation.</param>
    [HttpGet("month")]
    [MapToApiVersion("1.0")]
    [ProducesResponseType(typeof(ContentCalendarMonthResponseModel), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetMonth(
        [FromQuery, Required] int year,
        [FromQuery, Required] int month,
        [FromQuery] string? timeZone,
        [FromQuery] Guid? parentKey,
        CancellationToken cancellationToken)
    {
        if (year is < 2 or > 9998 || month is < 1 or > 12)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid month",
                Detail = "Year must be between 2 and 9998 and month between 1 and 12.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        IUser user = CurrentUser(_backOfficeSecurityAccessor);

        CalendarMonth result = await _queryService.GetMonthAsync(
            new MonthRange(year, month),
            new CalendarUser(user.Key, user.Id),
            timeZone,
            parentKey,
            cancellationToken);

        return Ok(ContentCalendarMapper.ToResponse(result));
    }
}
