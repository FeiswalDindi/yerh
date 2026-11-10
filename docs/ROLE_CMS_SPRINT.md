# Account, benefits and CMS sprint

Reference project: `C:/Users/user/Desktop/feiso/youth-venture-spark`.

## Reference analysis and implementation decisions

| Reference area             | Files examined in Feiso                                                                           | YERH implementation                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles and access           | `src/config/roles.ts`, route guards, platform route hooks                                         | Canonical roles and capability checks in `src/domain/roles.ts`; route guards and command-level checks use the same model.                                                                      |
| Account-first applications | `src/hooks/useRoleApplications.ts`, `src/pages/apply/ApplyForm.tsx`                               | Signup creates a guest account. Public role applications require an account and administrator approval. One pending application per account.                                                   |
| Account presentation       | Original YERH `features/demo/LoginPage.tsx` and `features/connect/JoinPage.tsx`                   | Restored original login selector and register/join pathway pages. Feiso-inspired animated authentication UI was removed at the user’s request; demo roles remain for development.              |
| Partners and investors     | `src/pages/dashboard/ComplementorDashboard.tsx`, complementor hooks                               | Separate user-facing Partner and Investor roles share organisation, opportunity and applicant workflows. Organisation approval precedes opportunity creation. Both discover approved ventures. |
| Opportunities              | Public opportunity overview, listing and detail pages                                             | Featured listing, search, categories, opening/deadline states, deadline filter, sorting, eligibility, benefits, preparation documents and internal/external application routes.                |
| Events                     | `src/pages/events/PublicEvents.tsx`                                                               | Calendar/date and type filters, upcoming listings, expandable details, two-at-a-time loading, past-event disclosure, host links and capacity-controlled registration.                          |
| Content administration     | `src/pages/admin/AdminSiteContent.tsx`, `AdminPagesContent.tsx`, related admin modules and routes | Content studio with module navigation, structured forms, previews, drafts, validation, publication, revision restoration and audit.                                                            |

The reference's Supabase implementation and secrets were not copied. YERH retains its existing React feature folders, domain functions, repository boundary and JSON fixtures. No new UI framework or data-fetching dependency was introduced.

## Roles

| Role                         | Available workflows                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public visitor               | Public pages, resources, public events, featured ventures and approved marketplace listings.                                                                                                                  |
| Registered guest             | Public browsing, own profile and applications for a public role. Registration does not grant entrepreneur permissions.                                                                                        |
| Youth Entrepreneur / Learner | Courses and progress, workshops/events, ventures, products, forums/groups, mentorship requests, opportunities and incubation applications.                                                                    |
| Mentor                       | Mentor biography, expertise and availability; mentorship request decisions; assigned incubation notes and milestone validation; community and events.                                                         |
| Partner / Investor           | Approved organisation profile, own opportunity drafts and review submissions, own applicants, approved venture discovery, community and events.                                                               |
| Content Manager              | Public editorial modules, site settings/navigation, content review, discussion moderation, CMS drafts/publication/restoration. Business and organisation identity approval remains an administrator function. |
| Platform Administrator       | All capabilities, role decisions, staff assignment, suspension, business/organisation/incubation approvals, certificate records, analytics and reporting.                                                     |

An account has one primary role, matching the reference's workflow. An approved role-change application replaces that primary role; its existing records remain. Staff roles cannot be selected on public application forms. An administrator cannot remove their own administrative access or suspend themselves.

## Workflow rules

- Roles: application → pending → approved or rejected, with reviewer and feedback. Rejected applicants can submit again.
- Ventures and products: owner submission → pending → administrator approval/rejection. Editing resubmits for approval. Products require an approved venture owned by the author.
- Organisations: profile submission → administrator approval. Profile edits require review again before new opportunities can be saved.
- Opportunities: owner draft → review → content-manager/administrator publication. Editing returns the listing to draft. Drafts and archived listings do not appear publicly.
- Internal applications: approved entrepreneur and owned approved venture, opening/deadline/capacity checks, duplicate protection, applicant withdrawal, owner/admin review. Submitted → shortlisted/accepted/rejected. Completed decisions cannot be replaced through the review action.
- External applications: explicit link to the organiser's HTTPS site. YERH does not claim that a redirected visitor submitted an application.
- Incubation: approved venture → application → administrator assigns active mentor → mentor updates/validates milestones → administrator graduates after every milestone is validated. A founder cannot validate their own progress.
- Learning: enrollment precedes progress tracking. Administrators can issue a local completion record only after all course lessons are complete. The learner can open the verification record from their dashboard.
- Events: anonymous browsing, approved-role reservation, capacity/deadline checks, individual cancellation before the start, and existing administrator attendance handling. All event-calendar days are interpreted in Nairobi time.

## CMS coverage

The studio manages articles, stories, public listings, homepage slides and featured references, site identity/contact/social links, navigation, public page headings and additional sections, courses, lessons, resource pathways, FAQs, sidebar widgets, media references/partners, terms, event sessions, opportunities, and community group/forum metadata.

New standalone pages use `/pages/<slug>`. Existing public pages can receive heading overrides and additional sections. Structural application logic, permission checks, transactional forms and layout CSS remain code-owned. Media fields reference existing local assets or HTTPS images; there is no fake file-upload service.

Drafts do not change public pages. Save and publish are separate commands. A stale draft cannot replace newer content. The five latest published snapshots are retained. Restoration creates a new revision and is refused if it would orphan registrations/applications or violate current capacities. Community publication preserves memberships. Archived editorial records remain available in the studio.

Organisation opportunity edits also increment the CMS revision, preventing an older full-site snapshot from discarding those edits. Contributions, ventures and products retain their workflow source of truth and enter the public catalogue through the existing overlay; their review and ownership are managed in their workspaces.

## Code and data boundaries

- `src/domain/roles.ts`: labels, canonical roles and capabilities.
- `src/domain/platform.ts`: typed entities and commands.
- `src/domain/platform-actions.ts`: transitions, permissions, ownership and audit.
- `src/domain/cms.ts`: CMS schema, safe URLs and reference validation.
- `src/domain/demo-validation.ts`: persisted-state validation and migration.
- `src/services/demo-repository.ts`: browser persistence adapter.
- `src/services/cms-snapshot.ts`: editor snapshots including archived records.
- `src/app/DemoCatalogOverlay.tsx`: latest public CMS release plus approved workflow content.
- `src/features/accounts`, `benefits`, `platform`, `cms`: presentation only.
- `src/mocks/data/accounts.json`, `platform.json`, `site.json`: new database-like seed data. Existing content, learning, community, sidebar, event and terms fixtures remain in the same mock-data folder.

## Backend handoff

This is a usable development demonstration, not a deployed identity or CMS service. Browser-local persistence cannot enforce security across users or devices. The local login selector uses development accounts, without passwords. Real account creation is handed off to a configured platform; production authentication remains pending backend integration. Demo mutation is disabled in production builds, preserving the existing development-only boundary.

The eventual backend must authenticate sessions, enforce every capability and ownership rule on the server, transact approvals/capacities/revisions, isolate private records, persist immutable audit history, support verified email/recovery/OAuth, supply secure uploads and deliver notifications. Replace the repository and command boundary with authenticated endpoints rather than distributing API calls into page components. Real certificate validation must come from the backend and an approved assessment policy.

See [TESTING_SPRINT.md](TESTING_SPRINT.md) for the complete acceptance walkthrough.
