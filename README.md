# YERH frontend

React + strict TypeScript frontend in `C:\Users\user\Desktop\yerh`. Feiso navy/gold tokens are retained, with the original YERH navigation hierarchy and wordmark.

## Run locally

```powershell
cd C:\Users\user\Desktop\yerh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Node 22.12+ is required. `npm run check` runs domain/fixture tests, TypeScript, and the production build. `npm run format:check` checks formatting.

## Where to change things

| Change                                                     | Location                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Desktop and mobile navigation                              | `src/mocks/data/site.json` (seed), CMS site settings (demo publication)              |
| Route definitions and compatibility redirects              | `src/app/routes.tsx`, `src/content/legacy-routes.json`                               |
| Blogs, stories, businesses, reports, events                | `src/mocks/data/*.json`                                                              |
| First hero card, slides, featured content, important links | `src/mocks/data/homepage.json`                                                       |
| Fictional accounts and community activity                  | `src/mocks/data/accounts.json`, `community.json`                                     |
| Learning, entrepreneurship, FAQs                           | `src/mocks/data/learning.json`, `lessons.json`, `entrepreneurship.json`, `faqs.json` |
| Brand colors                                               | `src/styles/tokens.css`                                                              |
| UI features                                                | `src/features/`                                                                      |
| Content fetching boundary                                  | `src/services/content-repository.ts`, `mock-content-repository.ts`                   |
| Demo persistence                                           | `src/services/demo-repository.ts`                                                    |
| Demo permissions and state transitions                     | `src/domain/demo.ts`                                                                 |
| Browser-data validation                                    | `src/domain/demo-validation.ts`                                                      |

## Try the demo

Open `/login` and select a development account. Guest, Entrepreneur/Learner, Mentor, Partner, Investor, Content Manager and Administrator roles remain available. Login uses the original YERH demo account selector; `/register` and `/join` use the original pathway page. Real account creation can hand off to `VITE_PLATFORM_URL` when configured. Demo role applications remain at `/apply`. Changes persist in this browser and are shared when switching roles.

- Entrepreneur/Learner: ventures/products, learning enrollment, community, mentorship, opportunities and incubation.
- Mentor: profile/expertise/availability, guidance requests, assigned incubation notes and validated milestones.
- Partner/Investor: approved organisation, own opportunities/applicants and venture discovery.
- Content Manager: full editorial studio, draft/publish/restore, contribution review and discussion moderation.
- Administrator: all capabilities, role/staff assignment, suspension, entity approvals, completion records and reporting.

**Start the full acceptance walkthrough in [docs/TESTING_SPRINT.md](docs/TESTING_SPRINT.md).** The running session uses http://127.0.0.1:5174; `npm run dev -- --port 5174` restarts that port. The default development command still uses 5173.

Only published demo contributions appear in public listings. Use Reset demo data on `/login` to restore fixtures. Bookmarks use a separate browser key and are retained by the demo reset. Production builds disable demo sign-in and mutations. The backend must supply real authorization; frontend role checks are only a development simulation.

The hero begins with **Idea to Business**, then rotates every 5 seconds. Hover, keyboard focus, hidden tabs, and reduced-motion preferences pause rotation. Manual arrows pause it until Play is chosen. The user-added slide bullets are retained.

## Maintenance

See `docs/MAINTENANCE_REVIEW.md` for the latest change review, component removal guide, preserved snapshot and remaining backend work.

## Documentation and originals

- `docs/ROLE_CMS_SPRINT.md`: Feiso audit, role workflows, CMS coverage and backend handoff.
- `docs/TESTING_SPRINT.md`: role accounts and end-to-end testing guide.
- `docs/FEATURE_AUDIT.md`: recovered features, source gaps, and implementation decisions.
- `docs/ARCHITECTURE.md`: code organization and extension points.
- `docs/INTEGRATION.md`: wiring into Feiso or another host.
- `docs/VALIDATION.md`: verification record.
- `docs/source-inventory.json`, `asset-manifest.json`, `route-migration.json`: traceability.
- `archive/yerh-original-archive.zip`: local backup of the unchanged original mirror, including raw HTML/CSS; excluded from Git.

The original Downloads mirror and Feiso project are not modified. `scripts/import-legacy.py` is a source extraction tool: run it into an empty staging folder, review output, and merge records into the mock fixtures. It refuses to overwrite an application root.
