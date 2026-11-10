# Architecture

## Boundaries

`app` composes routing and providers; `layout` owns shared chrome; `features` contains pages grouped by user capability; `shared` contains presentation helpers. `domain` owns TypeScript models and pure business rules. `services` implements data access and mappings. `mocks/data` is the only home for seeded database-like records. `config` stores adapter defaults and asset paths. Database-bound site settings/navigation live in `mocks/data/site.json` and are exposed through the catalogue. Styles use Feiso brand tokens.

Public content travels from JSON fixtures through `mockContentRepository` to `ContentProvider`, then `useCatalog`. Swap the repository for a validated HTTP/CMS adapter without embedding requests inside cards or pages. Imported records retain source URL, source path and SHA-256. A local published contribution has explicit `local-demo` provenance and no invented original-source link.

Community demo state travels through `DemoRepository` → `DemoProvider` → `useDemo`. Actions go through `applyDemoAction` before persistence. Validation rejects malformed nested browser records, invalid dates/timezones, orphaned relationships, duplicate connections/registrations, unknown active IDs and unapproved role changes. New accounts are allowed; role applications and administrator assignments carry an audit trail. Failed writes surface an error and do not claim success. Storage events refresh other tabs. State version 2 retains the `yerh.demo.v1` key and migrates valid v1 edits before validation; it can be reset from Login.

Connected profiles, public feed/rank selectors, consent-based friendships and capacity-aware session commands live in `domain/community.ts`. Session metadata and member blogs are fixtures. See [COMMUNITY_INTEGRATION.md](COMMUNITY_INTEGRATION.md) for the reference findings, relationships, privacy rules, verification limits and backend contract.

Contexts/hooks are in separate modules from providers, keeping context identity stable during development hot reload. Route pages are lazy loaded. Current mock collections are small and loaded together; a real backend should add paginated query endpoints, caching, cancellation, and per-feature loading/error states for larger datasets.

## Navigation

One typed tree renders desktop dropdowns and mobile disclosures. Main links navigate, adjacent buttons expand. Keyboard users can open with ArrowDown, close with Escape, and tab through nested links. Menus close on route changes and loss of focus. Home owns About/FAQ; Benefits follows Resources and owns Opportunities/Events; Publications owns stories/blogs/reports. The typed default tree reads `site.json`; the published CMS snapshot can override it. Previous `/news`, `/stories` and `/businesses` URLs redirect to canonical routes.

## Demo permissions

The pure reducer is the single simulated mutation policy. Draft owners may edit drafts and submit for review. Content Managers can review every editorial content kind; administrators also approve venture and organisation identity. Publication requires review status. Content Managers and administrators moderate discussions; hidden topics reject new replies. Mentor responses require the assigned mentor or admin. Requests cannot be duplicated while active. Learning and membership are account-specific.

These rules are not a security boundary. The production API must enforce identity, ownership, validation and authorization independently. The demo is guarded by Vite's `import.meta.env.DEV`; production does not read active demo sessions or accept demo mutations.

## Adding features

1. Define domain types and permission/transition rules.
2. Add isolated fixtures with stable IDs and provenance (or explicit fictional labeling).
3. Add/extend a repository adapter and map external payloads into domain models.
4. Implement a feature page using provider hooks; add routes and navigation entries.
5. Test meaningful rules, relationships and failure states; verify keyboard/mobile behavior.

Static workflow copy stays with UI/config. CMS-managed public copy, menu labels and page sections are seeded in mock data. Records that would normally come from the database (articles, businesses, accounts, lessons, requests, etc.) stay in fixtures or repositories. No mirror HTML is injected or executed.

## Feature maintenance boundaries

Membership display uses a shared compact roster for groups and forums; forum membership remains compatible with older saved records. Group activity uses a concise timeline. `features/home/StoryPortrait` owns explicit hover/tap/keyboard reveal state. `features/legal` presents a shared `Catalog.terms` document from `mocks/data/terms.json` as a footer-triggered dialog and full page. Neutral card surfaces share `--yerh-card-surface`. See [COMMUNITY_UX.md](COMMUNITY_UX.md) for behavior and backend privacy requirements.

Discovery sidebars live in `features/discovery`, with pure recommendation, public comment and Nairobi calendar rules in `domain/sidebar.ts`. Database-bound widget configuration, popularity and article comments live in `mocks/data/sidebar.json`, loaded through `mockContentRepository` into `Catalog.sidebar`. Forum calendar filters compose in URL query parameters. See [SIDEBARS.md](SIDEBARS.md) for page placement and the backend contract.

The homepage is a composition of independent sections and sidebar widgets under `features/home`. Privacy UI and media playback have separate feature folders; persistence lives in `services/cookie-consent.ts`, with strict video URL mapping in `domain/media.ts`. Feature-owned styles live alongside their features and are imported through `styles/index.css`.

`useCatalog` has no dependency on demo state. The optional `DemoCatalogOverlay` combines the latest published CMS catalogue with published contributions and approved ventures/products at the application composition root. Derived workflow records retain their source of truth outside editorial snapshots. Header identity and member workflows still use the session/demo provider until a real authentication adapter is integrated. Database-like display metadata lives in fixtures; presentation labels stay in components/config.

See [MAINTENANCE_REVIEW.md](MAINTENANCE_REVIEW.md) for the review, safe removal points, remaining integration work and the pre-maintenance backup.

## Account, benefits and CMS modules

`domain/roles.ts` centralizes capabilities. `domain/platform-actions.ts` handles approval and ownership rules for role applications, organisations, ventures/products, opportunities, incubation, enrollment, completion records and CMS publishing. `domain/cms.ts` validates complete snapshots and references. `services/cms-snapshot.ts` retains archived editorial content in the editor while refreshing workflow-derived references from the current public catalogue. Workflow content remains read-only in the studio and is reviewed in its source workspace. All demo commands pass persisted-state validation before the repository writes.

CMS releases use optimistic revision checks and retain five snapshots. Restoring creates a new revision and cannot orphan active workflow records. Group/forum publication preserves member IDs. Existing v1/v2 browser state migrates without discarding supported profile edits. See [ROLE_CMS_SPRINT.md](ROLE_CMS_SPRINT.md) for the audited reference, module coverage, primary-role decision and backend responsibilities. See [TESTING_SPRINT.md](TESTING_SPRINT.md) for acceptance testing.
