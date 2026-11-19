# Sanlian Connect Reader Redesign

Local visual prototype for the four reader screens in the November reference: Home, Events, Bookshelf, and Reader's Corner. The live application, seat-reservation branch, reader records, and registration workflows are not part of this change.

## Visual Direction

- Keep the four-section navigation, three-column card grids on desktop, and back-to-list detail flows.
- Lead with a lakeside reading-room image, an ink-green palette, warm white paper, and a restrained red accent. Keep the photo legible as an image without making every page photo-led.
- Build event covers as category-specific editorial posters. Use one arrangement across the home shelf previews, all six bookshelf cards, and each shelf detail header: three books stand upright on one ledge, the front cover is unobstructed, and each rear cover is partly hidden by the book in front. Trim exterior photo margins without rewriting the source images. Show the whole framed front cover beside each recommendation. Use a ruled-page treatment around the suggestions form.
- Use real works and authored recommendations, not availability claims. Use real edition covers in the local preview, preferring Shanghai Sanlian and other confirmed Sanlian editions. Keep the edition sources with the prototype.
- Match the upstream language contract: default `zh-CN`, alternate `en`, preference key `sanlian-language`, and switch only UI copy. Keep authored titles, event copy and book recommendations in their original language.

## Tasks And Acceptance

1. Prepare a local hero asset, curated shelf data, and sample events.
2. Build the responsive views as a buildless, file-openable HTML prototype. Navigation, event search/filter, detail links, and shelf drill-down must work. The suggestions form previews a submission locally without transferring data.
3. Verify on desktop and narrow mobile: no page overflow, hero asset loads, nav and detail/back links work, each shelf lists three matching books, filtering has a working empty state, and the local suggestion flow does not send data externally.
4. Confirm all 18 local covers decode in both languages and that switching keeps the current route, event filters, and in-progress form fields.

The art direction and book selections are for review. Official store photography, actual event details, and permissions for publisher artwork remain a handoff decision.

## Local Preview And Verification

- Open [index.html](index.html) directly in a browser. No server, build, login, or production data is required.
- The six themed shelves use 18 real titles. See [Book Cover Sources](cover-sources.md) for the edition publishers and ISBNs. The covers are for visual review, not a statement of store inventory.
- The standalone preview follows the GitHub default branch's [language helper](https://github.com/hxs898570462/sanlian-connect/blob/main/public/js/i18n.js), [UI dictionary](https://github.com/hxs898570462/sanlian-connect/blob/main/public/js/messages-en.js), and [switch behavior](https://github.com/hxs898570462/sanlian-connect/blob/main/public/js/app.js#L187). Its script runs without modules over a local file URL. Browser storage remains scoped to the preview and is not shared with the deployed website.
- [reading-room.jpg](reading-room.jpg) was generated with built-in ImageGen: a wide editorial lakeside bookshop reading room, darker oak shelves at left and clear lake-facing windows, a reading table, and autumn daylight at right. It is a concept image, not a photo of the Tianjing Lake branch.
- Edge/Playwright verified the hero and all 18 covers, event filters and details, all six shelf/detail book matches, and the suggestion preview without outbound requests. All six cards passed the full-foreground-cover, overlap and shared-baseline checks at 1440, 801, 390 and 320 px; the home shelf previews and detail headers were also checked on desktop. Both languages were checked, including preference on reload, retention of route and unsaved form fields, and unchanged book content when switching. See the [desktop](screenshots/bookshelf-desktop-zh.png) and [mobile](screenshots/bookshelf-mobile-zh.png) screenshots.
- The repeatable check is `node docs/reader-design-preview/verify.cjs <playwright-module-path>` from the repository root, with Playwright and Microsoft Edge already available. New captures are written to the system temporary directory.
