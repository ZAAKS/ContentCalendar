# Content Calendar for Umbraco

A calendar for the Umbraco backoffice that shows, per day, which content was **created**, is
**scheduled to publish** or **scheduled to unpublish**, and was **deleted**.

## Features

- A **Calendar** dashboard in the Content section, with **Month**, **Week**, **Day** and **List** views.
- A **Calendar** view for a page's **Child items**, next to the Grid and List views.
- Each state has its own colour and state tile, and you can hide or show each state.
- Clicking an item opens it in a side drawer over the calendar, like the content picker.
- Users only see content they have access to.

## Requirements

- Umbraco 17.2 or later (17.x)
- .NET 10

## Install

```bash
dotnet add package ContentCalendar.V17
```

Open **Content → Calendar**.

### Calendar in Child items (optional)

1. Go to **Settings → Data Types** and open the Collection data type your document type uses.
2. Under **Layouts**, click **Choose**, pick **Content Calendar**, and **Save**.
3. Open a page → **Child items** → switch to **Calendar**.

## Configuration

Optional, in `appsettings.json`:

```json
{
  "ContentCalendar": {
    "MaxEntriesPerKind": 2000,
    "ShowDeleted": true,
    "ShowScheduledUnpublish": true
  }
}
```

## Development

```bash
dotnet build ContentCalendar.sln
cd src/ContentCalendar.Web17
dotnet run --launch-profile Umbraco.Web.UI   # https://localhost:44330/umbraco
```

## License

MIT