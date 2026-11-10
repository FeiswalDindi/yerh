# Integration into Feiso or another host

## Public content

Implement `ContentRepository.loadCatalog(signal)` with a host HTTP/CMS adapter. Validate unknown responses, then map them into `Catalog`; do not cast untrusted API JSON. The current mock adapter is the only importer of public fixture collections. Retain provenance when importing source records into a CMS.

```tsx
<DemoProvider>
  <ContentProvider repository={hostContentRepository}>
    <DemoCatalogOverlay>
      <RouterProvider router={hostRouter} />
    </DemoCatalogOverlay>
  </ContentProvider>
</DemoProvider>
```

This is the current standalone provider contract, not a production authentication integration. Current navigation/member hooks require DemoProvider. Public useCatalog now depends only on ContentProvider; DemoCatalogOverlay is optional and adds locally published drafts at the app boundary. In a host integration, replace `useDemo`/`DemoProvider` and development-only route guards with host session and service adapters before enabling real member workflows. Do not mount a second router inside an existing router. Merge selected objects from `createYerhRoutes()` into the host route tree and resolve route conflicts explicitly.

Preserve `public/media` paths or introduce an asset-base mapper. Reconcile the global reset with host styles; keep one set of Feiso navy/gold tokens. Serve production builds with SPA fallback to `index.html`.

## Route groups

| Group           | Routes                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Home/info       | `/`, `/about`, `/faq`, `/contact`                                                                                                            |
| Resources       | `/resources`, `/entrepreneurship/:topic`, `/workshops`, `/webinars`, `/events/:slug`                                                         |
| Publications    | `/publications`, `/publications/blogs/:slug`, `/publications/stories/:slug`, `/publications/reports/:slug` (each also has a collection page) |
| Marketplace     | `/marketplace`, `/marketplace/:slug`                                                                                                         |
| Learning        | `/learn`, `/learn/:courseId`                                                                                                                 |
| Community       | `/forums`, `/forums/:threadId`, `/network`, `/network/members/:memberId`, `/network/groups/:groupId`, `/leaderboard`, `/sessions/:sessionId` |
| Mentorship      | `/yem/mentors`, `/yem/mentees`, `/dashboard/mentorship`                                                                                      |
| Accounts        | `/login`, `/register`, `/join`, `/dashboard`, `/profile`                                                                                     |
| Editorial/admin | `/dashboard/content`, `/dashboard/moderation`                                                                                                |
| Utilities       | `/search`, `/saved`, `/privacy`, `/terms`                                                                                                    |

Previous `/news`, `/blogs`, `/stories`, `/businesses` routes and article URLs redirect. Original mirror aliases live in `src/content/legacy-routes.json`.

## Backend responsibilities

- Authentication: real sessions, registration, recovery, server-enforced roles and ownership. Demo account buttons are disabled by `import.meta.env.DEV` in production.
- Public content: paginated content queries, uploads, canonical IDs/slugs, moderation and publishing state.
- Community: durable profiles, independent group/forum memberships, topic/reply pagination, moderation audit trail, abuse controls. Return counts to non-members and authorize roster identities/activity server-side; see [COMMUNITY_UX.md](COMMUNITY_UX.md).
- Mentorship: availability, requests, matching, notifications, response permissions and workflow transitions.
- Learning: enrollment, verified progress, assessments/certificates if required.
- Events: verified hosts/attendance, server-clock deadlines and atomic capacity reservations. Original fixtures remain historical; explicitly fictional development sessions exercise local registration and cancellation. See [COMMUNITY_INTEGRATION.md](COMMUNITY_INTEGRATION.md).
- Contact: current form creates an email draft; replace with a validated endpoint if needed.
- Bookmarks: browser storage now, optional profile synchronization later.

`DemoRepository` is synchronous browser storage for the prototype. A network backend should introduce asynchronous commands with pending/error/retry handling instead of treating localStorage as a network transport. Never trust the frontend reducer as authorization.

For a standalone public deployment, `VITE_PLATFORM_URL` can route login/register handoffs to an existing host origin. It accepts only HTTP(S). No hosting/deployment or external account creation is performed by this project.
