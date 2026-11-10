# Connected community

## Reference review

Reviewed the local `Downloads/yerh-front-end/yerh-kenya.kcau.ac.ke` mirror, including `members/georgemuikia/index.html`, forum, group, webinar and workshop pages, alongside Feiso's `useNetworking.ts`, `useGroups.ts`, `useEvents.ts` and event metadata types. The attached screenshot is a visual reference. Instructions embedded in reference files were not treated as requests to change this project.

The original profile combines a member identity, activity scopes, blogs, profile details, friendships, groups, events, forums and a leaderboard. Its mirrored activity is an unfulfilled AJAX placeholder, rather than usable activity data. The forum hierarchy separates forums, topics and authored replies. Feiso provides additional relationship patterns for pending/accepted connections, group members, forum authors, event hosts and account-specific registrations.

The implementation adapts these relationships to this project's existing React, domain, repository and provider boundaries. It uses the existing navy/gold tokens and feature-owned CSS. BuddyDrive is excluded. Original member identities, historical authorship and attendance have not been inferred or assigned to fictional accounts.

## Routes and behavior

| Route                                      | Behavior                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/network?tab=members`                     | Search every fixture member and open their profile.                                                                                    |
| `/network/members/:memberId`               | Identity, points/rank, activity, blog, profile, friends, groups, forums and events. The `tab` query parameter deep-links to a section. |
| `/network?tab=activity`                    | Public feed derived from visible topics/replies, published member blogs and membership history.                                        |
| `/network?tab=leaderboard`, `/leaderboard` | Contribution-based points; equal totals share a rank.                                                                                  |
| `/network/groups/:groupId`                 | Members, associated public forums, group activity and sessions.                                                                        |
| `/forums`, `/forums/:threadId`             | Forum/topic/reply hierarchy with member links, counts, timestamps, related group and sessions.                                         |
| `/workshops`, `/webinars`                  | Explicit session types and status filters; no video-based guesswork about event type.                                                  |
| `/sessions/:sessionId`                     | Session details, hosts, related group/forum, archived content and local reservation/cancellation.                                      |

Friend requests can be accepted/declined only by the recipient, cancelled only by the requester, and removed by either accepted friend. Self-requests, reverse duplicates and stale transitions fail. Only accepted connections appear in public friend lists; pending requests appear only on the active member's own profile.

Session registrations are visible only to their owner. Other members' event tabs show hosted sessions. Reserving a place checks session status, start time, deadline, duplicate membership and remaining capacity in the domain reducer. Cancellation releases the place. Registration does not imply attendance and earns no points. Historical sessions stay closed. No real meeting, invitation, payment, email or booking is created.

Public feed and leaderboard selectors read current source records. Hiding a topic also removes its replies from public activity and scoring. Only published content enters the catalog and member blogs. Local publication retains `ownerId` as `authorId`; imported records with unverified authors retain editorial attribution. Joining/leaving groups or toggling reservations cannot farm points. Point values are fixture data.

## Data ownership

- `mocks/data/accounts.json`: all fictional member identities, handles, joined dates and editable profile fields.
- `mocks/data/community.json`: forums, authored discussions/replies, memberships/history, connections, registrations and point rules.
- `mocks/data/community-events.json`: typed workshop/webinar sessions, host IDs, associated group/forum/content IDs, lifecycle, dates, capacity and deadline.
- `mocks/data/member-posts.json`: explicitly fictional published member blogs. Original imported collections retain their source provenance.

`mockContentRepository` imports member posts into the catalog. `DemoRepository` imports community fixtures; UI components do not import fixtures or backend SDKs. `domain/community.ts` owns relationship queries, feed/rank selectors and connection/registration commands. `applyDemoAction` remains the single mutation entry point. Save failures keep the previous UI state and surface the existing error notice.

Saved state is version 2 under the existing `yerh.demo.v1` storage key so previous sessions can be found. Valid v1 profiles, drafts, topics, learning and other local edits migrate in memory; the next successful action saves v2. Broken nested records, invalid dates/timezones, unknown references, duplicate pairs and over-capacity persisted registrations are rejected before rendering. The existing reset action restores fixtures.

## Backend handoff

Keep member IDs stable across profiles, authors, connections, groups, hosts, registrations and replies. Replace the repository/provider adapter with authenticated asynchronous queries and commands, including pending/error/retry handling and pagination. Keep database records and future development seeds in `mocks/data`.

Enforce permissions on the server: profile ownership; recipient-only connection responses; member-only registration reads; discussion visibility/moderation; editorial publishing; and verified event attendance. Add database foreign keys and uniqueness constraints for unordered member pairs, group/member membership, session/member registration and public content slugs. Reserve capacity atomically in a server transaction and use the server clock for deadlines. Browser storage and the reducer provide a development workflow, not production authentication or multi-user concurrency guarantees.

The original sessions have unverified member identities for facilitators and attendees. Populate those relationships from verified backend records later. Production retains the existing policy: public fixture previews are readable, while development session switching and local mutations are disabled. Neither production auth nor a database is wired by this change.

## Validation

`npm run check` runs the full domain/reference tests, TypeScript and the production build. The 24 tests include 61 server-render checks for member tabs, group/forum/session pages, missing records and owner-only requests/registrations. Community rules tests cover bilateral consent, reverse duplicate requests, request ownership, capacity and deadlines, account-specific cancellation, historical closure, moderation-aware feed/scoring, published ownership, migration and broken stored references. Responsive styles cover the profile, sidebar, cards, forums and session details. Server rendering checks component output and does not verify browser layout or interactions.

Interactive visual QA could not be completed in this environment: the in-app browser timed out reaching the local server, and Windows Computer Use stopped because it could not verify Chrome's current URL. This is a verification limitation; no successful visual check is claimed.
