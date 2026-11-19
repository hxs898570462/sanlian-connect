# Reader Design Integration

The standalone preview in [reader-design-preview](reader-design-preview/design-spec.md) is a design reference. The released Express app must render the design from `public/` while continuing to use its existing API and PostgreSQL data.

## Scope And Contract

- Home uses the reading-room artwork and live published activities. Events and event details use the same date posters based on backend data. Existing event filters, login return, confirmation and registration writes keep their current routes.
- Bookshelf adds six curated collections of three editorial recommendations. The forward book shows its full cover and partly hides the two behind it. Collection detail shows each cover and recommendation in full. This is not store inventory. The existing database-backed catalogue and `#book/:id` links remain available to readers and the assistant.
- Reader's Corner keeps its existing authentication, records and suggestion submission. Only the presentation of the existing form changes.
- Use the app's language, locale, theme, font and session preferences. Store cover and hero assets under `public/` for the existing Express static host. No API, database, deployment command, or authentication changes.

## Acceptance

1. Render Home, Events, Bookshelf and Reader's Corner through the running Express app, not the static preview.
2. Verify a real isolated database flow for filtering and opening an event, registration and suggestion submission, and the original catalogue detail.
3. Check all shelf covers and overlap, Chinese/English, desktop/mobile, and large-text/dark preferences. Record external asset provenance using the [edition list](reader-design-preview/cover-sources.md). Artwork selection and any use on a public site need store review; this integration task does not publish to Render.

## Verification

- `npm test`: 104 passing checks against temporary local PostgreSQL, including public asset delivery and catalogue/cover mapping.
- Edge at 1440, 1024, 390 and 320 px: verified the Express-rendered reader pages, complete front covers and shelf overlap, original catalogue detail, English/Chinese switching, draft preservation, dark mode and extra-large type. Tested search, account creation and return to the selected event, explicit registration, and suggestion submission against an isolated local database.
- The existing Render service can deploy this branch after review and merge using its current settings. No shared data or deployment was changed by these checks.
