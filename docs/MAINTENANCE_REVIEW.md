# Maintenance review — 9 November 2026

## Review baseline

The folder has no Git repository/history. Observations compare the current files with the prior implementation documented in this chat and project docs; they are not an exhaustive Git diff. Before changes, the complete application source, tests, docs, public assets, scripts and root configuration were saved to `archive/before-maintenance-20261109-221754.zip`. Dependencies, runtime files and build output are reproducible and excluded. The original mirror ZIP remains unchanged.

## Changes noticed and preserved

- Two-column homepage with a persistent sidebar instead of the earlier full-width section layout.
- Green Forums hero card, five-second rotation, side arrows and bullet indicators.
- Story filters, image hover overlays, video lightbox and revised captions.
- Business contact details/social labels, publication update cards and Load More.
- News feed, important links, animated partners, statistics, and social channel selector with YouTube/WhatsApp/Facebook/Instagram.
- Feiso-style mobile account/navigation drawer, explicit sign-out actions, and redesigned four-column footer.
- Floating consent banner, cookie policy and preference controls.

The sidebar's News Feed label was preserved as a user change. It still links to Blogs; no separate News route or collection was introduced.

## Maintenance completed

| Concern                                        | Change                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large homepage with unrelated state            | `HomePage` now composes `FeatureCarousel`, `StoriesSection`, `BusinessesSection`, `UpdatesSection` and `HomeSidebar`; each section owns its state.                            |
| Sidebar tightly bundled                        | Five independent components under `features/home/widgets`.                                                                                                                    |
| Business names embedded in conditional UI      | Contacts/social labels in businesses fixtures; story grouping and display lines in story records.                                                                             |
| Hardcoded counters and misleading placeholders | Counters moved to homepage fixtures and labeled sample figures. Missing ratings show Not yet rated; dates/comments only render when present.                                  |
| Slide design determined by filename            | Explicit typed slide theme in fixtures.                                                                                                                                       |
| Cookie functions exported by a UI component    | Consent repository in services, subscription hook and UI under features/privacy. Validates stored choice and reports write failures.                                          |
| Essential Only still loaded YouTube            | Shared VideoPlayer mounts an iframe only with multimedia consent; choice changes propagate in the current tab and other tabs.                                                 |
| Arbitrary iframe fallback                      | Domain mapper accepts only HTTPS YouTube hosts and valid video IDs.                                                                                                           |
| Modal and drawer keyboard behavior             | Native video dialog with Escape/focus handling; mobile drawer is inert while closed, focuses its controls, traps Tab and restores previous scroll styles/focus.               |
| Motion controls removed                        | Carousel pauses on hover/focus/hidden tabs, respects reduced motion, and has a compact pause button. Partner motion respects reduced motion and pauses on hover/focus.        |
| Hover-only story actions                       | Keyboard focus and touch reveal the same actions.                                                                                                                             |
| Demo state coupled to public queries           | `useCatalog` reads only ContentContext. Optional DemoCatalogOverlay merges local published submissions at composition root.                                                   |
| Shared duplication                             | One WhatsApp icon, shared social-link configuration, separate MobileNavigationDrawer.                                                                                         |
| Feature CSS mixed into layout CSS              | Active homepage, privacy and video-dialog styles are in their owning feature directories. Shared styles retain their existing cascade.                                        |
| Misleading metadata                            | Drawer displays the member headline instead of the hub contact email as a member address; RSS-styled button is labeled Publications; preferences route opens actual controls. |

## Removing or extending features

- Remove a homepage section import and its JSX from `features/home/HomePage.tsx`; other section state is independent.
- Remove a sidebar widget import and JSX from `HomeSidebar.tsx`; other widgets remain independent.
- Remove privacy UI by removing its layout mount and routes. VideoPlayer safely defaults to blocking optional embeds when consent is absent; keep that service contract or replace it deliberately.
- Remove demo content enrichment by removing DemoCatalogOverlay in App; public catalog queries still work. Member pages/header identity still require a session provider until the host authentication adapter replaces them.
- Add/edit records in `mocks/data`; UI imports repositories/hooks, never fixtures directly.
- When deleting a whole routed feature, remove its route, navigation entries and legacy aliases together. Check shared imports before deleting assets/styles. No architecture can make deletion of a shared dependency consequence-free.

## Items to resolve later

1. No Git history: use version control before the next development round so changes have reliable diffs and rollback. This maintenance adds a ZIP snapshot and checksum manifest, not a remote repository.
2. Sidebar numbers are unverified development figures. Business contacts and the new illustration were preserved as supplied; verify current ownership/details before publishing.
3. Database choice remains open. Keep domain models stable and replace repository adapters; validate network payloads at that boundary. MySQL requires a server/API; no database credentials belong in frontend code.
4. Real authentication, ownership, publication permissions, media uploads, pagination, moderation audit and metrics require backend services. Local demo rules are not production security.
5. Current catalog loads all fixtures together. Add paginated per-feature queries when real dataset size justifies it; this maintenance does not introduce speculative database schemas.
6. Earlier unused homepage components/styles are retained to avoid deleting potentially reusable user work. They are not imported by the active homepage. Remove them separately once their reuse decision is made.

## Validation

Baseline: existing 13 tests and TypeScript passed before edits. Maintenance adds checks for video host validation, unknown consent values and record-driven homepage metadata. Browser checks cover preserved layout, consent blocking/allowing media, video dialog keyboard dismissal and mobile drawer behavior. Final validation: all 16 tests, strict TypeScript, Vite production build and Prettier checks pass. Desktop and 390 x 844 mobile browser checks passed. Detailed evidence is recorded in VALIDATION.md. The file-level before/after SHA-256 inventory is archive/maintenance-changes-20261109.json.
