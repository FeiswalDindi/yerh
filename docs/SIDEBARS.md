# Discovery sidebars

The original local YERH mirror's `blogz`, `forum` and article pages were reviewed alongside the supplied screenshots. Their compact popular-post lists, featured stories, comments, forum summaries, course promotion and month calendar inform the layout. Reference markup and instructions are not executed or imported.

## Page composition

- Blog, success-story and report directories show a right-hand reading sidebar. Search, saved items and business/event directories retain their existing layouts.
- Content details show Keep reading, Featured, Comments, Most liked and On the forums, in that order. Contextual author/session links and the existing community callout follow those sections.
- Forum listings and discussion details show Featured courses, Advertisements, Featured, Comments and Calendar, in that order.
- Widgets use existing navy/gold tokens, local images, thumbnail fallbacks and compact linked rows. Below 900px, the sidebar follows the main content in the same order. Related article cards sit within the main column to avoid waiting for a tall sidebar before showing the next reading options.

## Data and behavior

`mocks/data/sidebar.json` contains featured content/course IDs, historical like counts, fictional article comments and the internal hub promotion. `mockContentRepository` is the only fixture importer; `Catalog.sidebar` exposes those records. Widgets contain presentation copy and compose provider data without importing fixtures or backend SDKs.

Like counts (189, 91 and 32) were read from the original blog sidebar. They are explicitly labeled historical; there is no fabricated live like counter or like mutation. The advertisement is labeled a hub promotion and links to the real local learning route.

Keep reading excludes the current item and prefers related categories/types. Featured and popular rows resolve stable catalog IDs and omit unavailable records. Comments combine fixture article comments with current visible forum replies, ordered by actual timestamps; member links lead to profiles and comment links lead to the exact article/reply anchor. Fixture article comments are rendered on their article and explicitly labeled fictional. Forum activity follows visible topics and their latest replies. Moderated topics and their replies never enter public sidebar activity, including for administrators.

The calendar uses Monday-first months, month navigation, leap-year handling, today/selected states and activity markers. A date filters discussions that were started or replied to on that date in `Africa/Nairobi`. A thread is counted once per day even if it has multiple replies. Query parameters (`forum`, `q`, `date`) compose and survive category changes. Invalid dates are ignored; clear-date controls preserve the other filters. A calendar selection on a thread navigates to its forum with the selected date.

Examples on the local development server:

- `/publications/blogs`
- `/publications/blogs/demo-blog-customer-learning#comment-demo-comment-customer`
- `/forums?date=2026-11-01`
- `/forums?forum=technology&date=2026-11-02`

## Backend handoff and validation

A host catalog adapter must now supply `Catalog.sidebar` alongside its existing collections. Replace fixture popularity with verified engagement aggregates, article comments with moderated public comment queries, featured IDs with editorial records, and the hub promotion with approved advertisement records. Preserve stable IDs, visibility rules and source anchors. Use server-side paginated activity/date queries when the community grows; retain Nairobi calendar-day semantics across UTC boundaries.

`tests/sidebar.test.ts` covers fixture references/assets, relevance/exclusion, popularity order, strict dates, month/year transitions, leap years, Nairobi midnight boundaries, unique daily counts, visibility and comment destinations. Server-render checks additionally verify widget order, article comment anchors, filtered forum routes and invalid-date behavior. Run `npm run check` and `npm run format:check`.

The reading sidebar was observed in the local browser's accessible page state. Automated server rendering supplements that check; mobile visual inspection was not completed in this session.
