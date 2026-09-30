
WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

#if DEBUG
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
#endif

builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddComposers()
    .Build();

WebApplication app = builder.Build();


await app.BootUmbracoAsync();

if (app.Environment.IsDevelopment())
{
    // The backoffice cache-busts package entry points with the package version (?umb__rnd=1.0.0), which does not
    // change between local client builds. Force revalidation so a rebuilt client shows up on a normal reload.
    app.Use((context, next) =>
    {
        if (context.Request.Path.StartsWithSegments("/App_Plugins", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.OnStarting(() =>
            {
                context.Response.Headers.CacheControl = "no-cache";
                return Task.CompletedTask;
            });
        }

        return next(context);
    });
}

app.UseUmbraco()
    .WithMiddleware(u =>
    {
        u.UseBackOffice();
        u.UseWebsite();
    })
    .WithEndpoints(u =>
    {
        u.UseBackOfficeEndpoints();
        u.UseWebsiteEndpoints();
    });

await app.RunAsync();
