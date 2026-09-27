namespace ContentCalendar.Core.Models;

/// <summary>
/// Version-agnostic identity of the backoffice user a calendar query runs on behalf of.
/// Each edition's repository resolves this to its own user model (for example <c>IUser</c>)
/// so that Core never has to reference a specific Umbraco major.
/// </summary>
/// <param name="Key">The user's unique key.</param>
/// <param name="Id">The user's integer id.</param>
public sealed record CalendarUser(Guid Key, int Id);
