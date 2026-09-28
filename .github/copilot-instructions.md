# Copilot instructions

Content Calendar is an Umbraco 17 backoffice package (NuGet: `ContentCalendar.V17`).

- `src/ContentCalendar.Core`: version-agnostic models, abstractions and query logic. No Umbraco references.
- `src/ContentCalendar.V17`: Management API controller, `Persistence/` repository (narrow SQL plus permission filtering) and the backoffice client in `Client/` (Lit + TypeScript, Vite, FullCalendar).
- `src/ContentCalendar.Web17`: local development site only, not shipped.

When reviewing pull requests, focus on:

- Security: users must only see content they have access to (start nodes, Browse permission, recycle bin rules). SQL must stay parameterised.
- Performance: queries are per month and capped by `MaxEntriesPerKind`; avoid loading full content items.
- Umbraco compatibility: the package supports Umbraco `[17.2.0, 18.0.0)`; do not use APIs newer than 17.2 without a fallback, and never change Umbraco core files.
- Backoffice UI: use Umbraco UI Library (`uui-*`) components and backoffice patterns, keep keyboard and screen reader support, and localise user-facing text.
