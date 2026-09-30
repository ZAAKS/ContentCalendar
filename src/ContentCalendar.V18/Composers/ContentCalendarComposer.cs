using ContentCalendar.Backoffice;
using ContentCalendar.Backoffice.Persistence;
using ContentCalendar.Core.Abstractions;
using ContentCalendar.Core.Models;
using ContentCalendar.Core.Services;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Cms.Api.Management.OpenApi;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace ContentCalendar.V18.Composers;

/// <summary>
/// Wires Content Calendar into an Umbraco 18 site: services, options and a dedicated OpenAPI document
/// (<c>/umbraco/openapi/content-calendar.json</c>) used to generate the TypeScript client.
/// </summary>
/// <remarks>
/// Umbraco 18 replaced Swashbuckle SwaggerGen with Microsoft.AspNetCore.OpenApi, so the document is registered with
/// <c>AddBackOfficeOpenApiDocument</c> (available since 18.0.0) instead of <c>SwaggerGenOptions</c>.
/// </remarks>
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

        builder.AddBackOfficeOpenApiDocument(
            ContentCalendarApiConstants.ApiName,
            document => document
                .WithTitle("Content Calendar Management API")
                .WithBackOfficeAuthentication()
                .WithJsonOptions(Constants.JsonOptionsNames.BackOffice)
                .ConfigureOpenApiOptions(options =>
                {
                    // Like Umbraco's own Management API document: no absolute server URL, so a client generated
                    // from any site uses relative ('/') URLs.
                    options.AddDocumentTransformer((openApiDocument, _, _) =>
                    {
                        openApiDocument.Servers?.Clear();
                        return Task.CompletedTask;
                    });
                    options.AddOperationTransformer<ContentCalendarOperationIdTransformer>();
                }));
    }
}

/// <summary>Produces short operation ids (e.g. <c>GetMonth</c>) so the generated client has tidy method names.</summary>
/// <remarks>Runs after Umbraco's own <see cref="UmbracoOperationIdTransformer"/>, which would otherwise produce path-based ids.</remarks>
public sealed class ContentCalendarOperationIdTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        if (context.Description.ActionDescriptor is ControllerActionDescriptor descriptor
            && descriptor.ControllerTypeInfo.Namespace?.StartsWith("ContentCalendar.", StringComparison.Ordinal) is true)
        {
            operation.OperationId = descriptor.ActionName;
        }

        return Task.CompletedTask;
    }
}
