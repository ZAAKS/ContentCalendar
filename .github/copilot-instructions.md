# Copilot instructions

Content Calendar is an Umbraco backoffice package with one NuGet package per Umbraco major: `ContentCalendar.V17` (Umbraco 17) and `ContentCalendar.V18` (Umbraco 18).

- `src/ContentCalendar.Core`: version-agnostic models, abstractions and query logic. No Umbraco references. Embedded in each edition package.
- `src/ContentCalendar.Backoffice`: shared source (a shared project imported by both editions): Management API controller, `Persistence/` repository (narrow SQL plus permission filtering) and the backoffice client in `Client/` (Lit + TypeScript, Vite, FullCalendar). One client bundle serves both majors.
- `src/ContentCalendar.V17` / `src/ContentCalendar.V18`: the edition packages. Only version-specific code lives here (the composer: Swashbuckle in v17, Microsoft.AspNetCore.OpenApi in v18).
- `src/ContentCalendar.Web17` / `src/ContentCalendar.Web18` and `src/ContentCalendar.DevSeed`: local development sites and demo data only, not shipped.

When reviewing pull requests, focus on:

- Security: users must only see content they have access to (start nodes, Browse permission, recycle bin rules). SQL must stay parameterised.
- Performance: queries are per month and capped by `MaxEntriesPerKind`; avoid loading full content items.
- Umbraco compatibility: shared code must work on both supported ranges, Umbraco `[17.2.0, 18.0.0)` and `[18.0.0, 19.0.0)`; do not use APIs newer than 17.2 in shared code without a fallback, keep version-specific code in the edition projects, and never change Umbraco core files.
- Backoffice UI: use Umbraco UI Library (`uui-*`) components and backoffice patterns, keep keyboard and screen reader support, and localise user-facing text.