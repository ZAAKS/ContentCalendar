using ContentCalendar.Backoffice;
using ContentCalendar.Backoffice.Persistence;
using ContentCalendar.Core.Abstractions;
using ContentCalendar.Core.Models;
using ContentCalendar.Core.Services;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Cms.Api.Management.OpenApi;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace ContentCalendar.V17.Composers;

/// <summary>
/// Wires Content Calendar into an Umbraco 17 site: services, options and a dedicated Swagger document
/// (<c>/umbraco/swagger/content-calendar/swagger.json</c>) used to generate the TypeScript client.
/// </summary>
public sealed class ContentCalendarComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services
            .AddOptions<ContentCalendarOptions>()
            .Bind(builder.Config.GetSection(ContentCalendarOptions.SectionName));

        builder.Services.AddScoped<IContentCalendarRepository, ContentCalendarRepository>();
        builder.Services.AddScoped<IContentCalendarQueryService>(sp => new ContentCalendarQueryService(
            sp.GetRequiredService<IContentCalendarRepository>(),
            sp.GetRequiredService<IOptionsSnapshot<ContentCalendarOptions>>().Value));

        builder.Services.AddSingleton<IOperationIdHandler, ContentCalendarOperationIdHandler>();
        builder.Services.Configure<SwaggerGenOptions>(options =>
        {
            options.SwaggerDoc(
                ContentCalendarApiConstants.ApiName,
                new OpenApiInfo { Title = "Content Calendar Management API", Version = "1.0" });

            options.OperationFilter<ContentCalendarOperationSecurityFilter>();
        });
    }
}

/// <summary>Enables Umbraco backoffice authentication for the Content Calendar Swagger document.</summary>
public sealed class ContentCalendarOperationSecurityFilter : BackOfficeSecurityRequirementsOperationFilterBase
{
    protected override string ApiName => ContentCalendarApiConstants.ApiName;
}

/// <summary>Produces short operation ids (e.g. <c>GetMonth</c>) so the generated client has tidy method names.</summary>
/// <remarks>Implements the interface directly (rather than subclassing) to stay compatible across 17.x minors.</remarks>
public sealed class ContentCalendarOperationIdHandler : IOperationIdHandler
{
    public bool CanHandle(ApiDescription apiDescription)
        => apiDescription.ActionDescriptor is ControllerActionDescriptor descriptor
           && descriptor.ControllerTypeInfo.Namespace?.StartsWith("ContentCalendar.", StringComparison.Ordinal) is true;

    public string Handle(ApiDescription apiDescription)
        => apiDescription.ActionDescriptor is ControllerActionDescriptor descriptor
            ? descriptor.ActionName
            : apiDescription.ActionDescriptor.DisplayName ?? "Unknown";
}
