using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Strings;

namespace ContentCalendar.DevSeed;

/// <summary>
/// DEV SITE ONLY. Seeds demo content so the calendar has something to show:
/// created dates spread over several months, pending (future) publish schedules, a busy day for the "+N"
/// overflow, variant (per-culture) schedules, and a user restricted to one branch for permission testing.
/// Runs once, in Development, when enabled via <c>ContentCalendarDevSeed:Enabled</c>.
/// </summary>
public sealed class ContentCalendarDevSeedComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
        => builder.AddNotificationAsyncHandler<UmbracoApplicationStartedNotification, ContentCalendarDevSeeder>();
}

public sealed class ContentCalendarDevSeeder : INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
    public const string LandingAlias = "calendarLanding";
    public const string ArticleAlias = "calendarArticle";
    public const string CampaignAlias = "calendarCampaign";
    public const string RestrictedGroupAlias = "calendarBranchEditors";
    public const string SecondCulture = "da-DK";

    // Built-in keys (the Constants.Security *Key fields are marked obsolete in v17 in favour of renamed members).
    private static readonly Guid SuperUserKey = new("1E70F841-C261-413B-ABB2-2D68CDB96094");
    private static readonly Guid EditorGroupKey = new("44DC260E-B4D4-4DD9-9081-EEC5598F1641");

    private readonly IHostEnvironment _hostEnvironment;
    private readonly IConfiguration _configuration;
    private readonly IRuntimeState _runtimeState;
    private readonly IContentTypeService _contentTypeService;
    private readonly IContentService _contentService;
    private readonly ILanguageService _languageService;
    private readonly IUserGroupService _userGroupService;
    private readonly IUserService _userService;
    private readonly IShortStringHelper _shortStringHelper;
    private readonly ILogger<ContentCalendarDevSeeder> _logger;

    public ContentCalendarDevSeeder(
        IHostEnvironment hostEnvironment,
        IConfiguration configuration,
        IRuntimeState runtimeState,
        IContentTypeService contentTypeService,
        IContentService contentService,
        ILanguageService languageService,
        IUserGroupService userGroupService,
        IUserService userService,
        IShortStringHelper shortStringHelper,
        ILogger<ContentCalendarDevSeeder> logger)
    {
        _hostEnvironment = hostEnvironment;
        _configuration = configuration;
        _runtimeState = runtimeState;
        _contentTypeService = contentTypeService;
        _contentService = contentService;
        _languageService = languageService;
        _userGroupService = userGroupService;
        _userService = userService;
        _shortStringHelper = shortStringHelper;
        _logger = logger;
    }

    public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
    {
        if (_hostEnvironment.IsDevelopment() is false
            || _configuration.GetValue<bool>("ContentCalendarDevSeed:Enabled") is false
            || _runtimeState.Level != RuntimeLevel.Run
            || _contentTypeService.Get(ArticleAlias) is not null)
        {
            return;
        }

        _logger.LogInformation("Content Calendar dev seed: creating demo data");

        await EnsureLanguageAsync();
        IContentType article = await CreateContentTypeAsync(ArticleAlias, "Calendar Article", "icon-newspaper color-orange", allowedAsRoot: false);
        IContentType landing = await CreateContentTypeAsync(LandingAlias, "Calendar Landing", "icon-home color-blue", allowedAsRoot: true, allowed: article);
        IContentType campaign = await CreateContentTypeAsync(CampaignAlias, "Calendar Campaign", "icon-megaphone color-green", allowedAsRoot: true, variant: true);

        DateTime now = DateTime.UtcNow;
        DateTime today = new(now.Year, now.Month, now.Day, 0, 0, 0, DateTimeKind.Utc);

        IContent siteA = CreateNode("Site A (News)", Constants.System.Root, landing, today.AddMonths(-4).AddHours(9));
        IContent siteB = CreateNode("Site B (Blog)", Constants.System.Root, landing, today.AddMonths(-4).AddHours(10));
        Save(siteA);
        Save(siteB);

        var random = new Random(1234);

        // Created dates spread over the last ~4 months.
        for (var i = 0; i < 30; i++)
        {
            IContent parent = i % 3 == 0 ? siteB : siteA;
            DateTime created = today.AddDays(-random.Next(0, 120)).AddHours(random.Next(7, 19)).AddMinutes(random.Next(0, 60));
            Save(CreateNode($"{(parent == siteA ? "News" : "Blog")} item {i + 1}", parent.Id, article, created));
        }

        // A busy day three days ago, to exercise the "+N" overflow for created items.
        DateTime busyDay = today.AddDays(-3);
        for (var i = 0; i < 7; i++)
        {
            Save(CreateNode($"Busy day article {i + 1}", siteA.Id, article, busyDay.AddHours(8 + i).AddMinutes(i * 7)));
        }

        // Pending (future) publish schedules.
        for (var i = 0; i < 12; i++)
        {
            IContent parent = i % 4 == 0 ? siteB : siteA;
            DateTime release = today.AddDays(random.Next(1, 60)).AddHours(random.Next(7, 19));
            IContent node = CreateNode($"Upcoming {(parent == siteA ? "news" : "post")} {i + 1}", parent.Id, article, now.AddMinutes(-i));
            Save(node, Schedule(Constants.System.InvariantCulture, release));
        }

        // A busy scheduled day for the "+N" overflow of scheduled items.
        DateTime launchDay = today.AddDays(10).AddHours(9);
        for (var i = 0; i < 5; i++)
        {
            IContent node = CreateNode($"Launch day piece {i + 1}", siteA.Id, article, now);
            Save(node, Schedule(Constants.System.InvariantCulture, launchDay.AddMinutes(i * 30)));
        }

        // Variant content: different release dates per culture.
        for (var i = 0; i < 3; i++)
        {
            IContent item = _contentService.Create($"Campaign {i + 1}", Constants.System.Root, campaign.Alias);
            item.SetCultureName($"Campaign {i + 1} (EN)", "en-US");
            item.SetCultureName($"Kampagne {i + 1} (DA)", SecondCulture);
            item.CreateDate = today.AddDays(-(i * 5) - 1).AddHours(11);

            var schedule = new ContentScheduleCollection();
            schedule.Add("en-US", today.AddDays(5 + i).AddHours(8), null);
            schedule.Add(SecondCulture, today.AddDays(7 + i).AddHours(8), null);
            Save(item, schedule);
        }

        await CreateRestrictedUserAsync(siteB);

        _logger.LogInformation("Content Calendar dev seed: done");
    }

    private IContent CreateNode(string name, int parentId, IContentType type, DateTime createdUtc)
    {
        IContent content = _contentService.Create(name, parentId, type.Alias);

        // Explicitly set (dirty) CreateDate values are preserved on first save.
        content.CreateDate = createdUtc;
        return content;
    }

    private void Save(IContent content, ContentScheduleCollection? schedule = null)
    {
        OperationResult result = _contentService.Save(content, userId: null, schedule);
        if (result.Success is false)
        {
            _logger.LogWarning("Content Calendar dev seed: could not save {Name}: {Result}", content.Name, result.Result);
        }
    }

    private static ContentScheduleCollection Schedule(string culture, DateTime releaseUtc)
    {
        var schedule = new ContentScheduleCollection();
        schedule.Add(culture, releaseUtc, null);
        return schedule;
    }

    private async Task EnsureLanguageAsync()
    {
        if (await _languageService.GetAsync(SecondCulture) is not null)
        {
            return;
        }

        await _languageService.CreateAsync(new Language(SecondCulture, "Danish (Denmark)"), SuperUserKey);
    }

    private async Task<IContentType> CreateContentTypeAsync(
        string alias,
        string name,
        string icon,
        bool allowedAsRoot,
        bool variant = false,
        IContentType? allowed = null)
    {
        var contentType = new ContentType(_shortStringHelper, Constants.System.Root)
        {
            Alias = alias,
            Name = name,
            Icon = icon,
            AllowedAsRoot = allowedAsRoot,
            Variations = variant ? ContentVariation.Culture : ContentVariation.Nothing,
        };

        if (allowed is not null)
        {
            contentType.AllowedContentTypes = [new ContentTypeSort(allowed.Key, 0, allowed.Alias)];
        }

        var result = await _contentTypeService.CreateAsync(contentType, SuperUserKey);
        if (result.Success is false)
        {
            throw new InvalidOperationException($"Could not create content type {alias}: {result.Result}");
        }

        return _contentTypeService.Get(alias)!;
    }

    private async Task CreateRestrictedUserAsync(IContent startNode)
    {
        var password = _configuration["ContentCalendarDevSeed:RestrictedUserPassword"];
        var email = _configuration["ContentCalendarDevSeed:RestrictedUserEmail"] ?? "branch.editor@example.com";
        if (string.IsNullOrWhiteSpace(password))
        {
            _logger.LogInformation("Content Calendar dev seed: no RestrictedUserPassword configured, skipping restricted user");
            return;
        }

        IUserGroup? editors = await _userGroupService.GetAsync(EditorGroupKey);
        var group = new UserGroup(_shortStringHelper)
        {
            Alias = RestrictedGroupAlias,
            Name = "Calendar Branch Editors",
            Icon = "icon-users",
            StartContentId = startNode.Id,
            Permissions = new HashSet<string>(editors?.Permissions ?? new HashSet<string>()),
        };
        group.AddAllowedSection(Constants.Applications.Content);

        var groupResult = await _userGroupService.CreateAsync(group, SuperUserKey);
        if (groupResult.Success is false)
        {
            _logger.LogWarning("Content Calendar dev seed: user group failed: {Status}", groupResult.Status);
            return;
        }

        var createResult = await _userService.CreateAsync(
            SuperUserKey,
            new UserCreateModel
            {
                Email = email,
                UserName = email,
                Name = "Branch Editor",
                Kind = UserKind.Default,
                UserGroupKeys = new HashSet<Guid> { groupResult.Result.Key },
            },
            approveUser: true);

        if (createResult.Success is false || createResult.Result.CreatedUser is null)
        {
            _logger.LogWarning("Content Calendar dev seed: user creation failed: {Status}", createResult.Status);
            return;
        }

        var passwordResult = await _userService.ChangePasswordAsync(
            SuperUserKey,
            new ChangeUserPasswordModel { UserKey = createResult.Result.CreatedUser.Key, NewPassword = password });
        if (passwordResult.Success is false)
        {
            _logger.LogWarning("Content Calendar dev seed: setting password failed: {Status}", passwordResult.Status);
        }
    }
}
