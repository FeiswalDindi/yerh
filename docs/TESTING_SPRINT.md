# Testing the roles, benefits and CMS sprint

## Open the development site

Use **http://127.0.0.1:5174/** for the running server. Keep the same hostname and port throughout testing: `localhost`, `127.0.0.1`, and different ports have separate browser storage.

To start this port again from the project folder:

```powershell
npm run dev -- --port 5174
```

The default `npm run dev` uses port 5173. Use the URL printed by Vite if you start that command instead.

All test changes are saved in this browser's local storage. They survive refresh and are shared between tabs on the same origin. Switching demo roles switches the active account in those tabs. They are not shared with another browser/device. Resetting demo data removes local test changes and CMS revisions.

## Demo accounts

Open `/login` and select **Login as …** on a demo account card. No password is needed. The original YERH login and registration/pathway pages are restored; there is no animated login/signup form or local email/password form.

| Account email                | Initial role                 | Useful test                                      |
| ---------------------------- | ---------------------------- | ------------------------------------------------ |
| `demo-guest@example.test`    | Guest / Public Visitor       | Account-first role applications                  |
| `demo-founder@example.test`  | Youth Entrepreneur / Learner | Already owns an approved venture                 |
| `demo-mentee@example.test`   | Youth Entrepreneur / Learner | Separate learner, isolation checks               |
| `demo-mentor@example.test`   | Mentor                       | Requests, expertise, availability, milestones    |
| `demo-partner@example.test`  | Partner                      | Approved organisation, market-access opportunity |
| `demo-investor@example.test` | Investor                     | Approved organisation, seed-grant applicants     |
| `demo-editor@example.test`   | Content Manager              | Full editorial studio and moderation             |
| `demo-admin@example.test`    | Platform Administrator       | Roles, approvals, users, reporting, certificates |

Use **Sign Out** to browse as a public visitor. Existing development accounts can be switched on `/login`. To start over, `/login` → **Reset demo data** → **Reset local demo**.

## 1. Public browsing and navigation

1. Sign out. Confirm **Benefits** follows **Resources**, with **Opportunities** and **Events** in its menu. Repeat with the mobile menu.
2. Visit `/opportunities`. Test search, category, open/closed/opening-soon status, deadline and sorting. **Reset** clears filters. No opening-soon results is valid for the supplied fixtures.
3. Open **Youth venture seed grant**. Check benefits, eligibility, stages, sectors and preparation documents. The apply button leads to sign-in.
4. Visit `/events`. Use the calendar arrows, a marked day, the date field and type filter. Clear filters. Expand **Details**, use **Load more events** when available, and expand **Past events**.
5. Open a session. Public visitors see hosts and registration information without a personal reservation. Completed/past sessions refuse registration. Seeded future dates eventually become past naturally; edit a future session through the CMS if testing later.

## 2. Original account pages, applications and role approval

1. Open `/login`. Confirm the original YERH heading and demo account cards appear, including Guest, Entrepreneur/Learner, Mentor, Partner, Investor, Content Manager and Administrator. There should be no sliding panels, Google buttons or password form.
2. Open `/register` and `/join`. Confirm the original pathway choices appear. Select a path and use **Show my next step**. Real account creation is offered through the connected platform when `VITE_PLATFORM_URL` is configured.
3. Return to `/login`, choose **Guest / Public Visitor**, then open `/apply`. The guest has no venture, enrollment or publishing permissions yet.
4. Apply for **Youth Entrepreneur / Learner** with at least 30 characters of motivation. Confirm **pending** status and that a second pending application is blocked.
5. Switch to the administrator on `/login`. Open **Administration** or `/dashboard/workspace?tab=approvals`.
6. Review the guest's role application, add at least ten characters of feedback, and approve. Reopen the same account from `/login`; its card now reflects the approved role. Its dashboard exposes entrepreneur tools. Refresh to check persistence.
7. Test rejection with another public-role application. The applicant sees feedback, retains its current role and can apply again. Mentor applications require expertise; Partner/Investor applications require an organisation name. Staff roles are absent from public applications.

## 3. Ventures and products

1. As the new approved entrepreneur, open **Ventures & products** → **My ventures**. Submit a venture with a useful description, sector, stage and location.
2. Confirm **pending**. Switch to administrator and approve it from the approval queue after reviewing its details.
3. Return to the owner. Create a product under that venture, then approve the product as administrator.
4. Check `/marketplace`: approved ventures/products appear. A pending/rejected product does not.
5. Use **Edit & resubmit** on the venture/product. It returns to pending and requires approval again. A second learner cannot edit the owner's records or use that venture in their own applications.

## 4. Partner/Investor → opportunity → applicant

1. Use the seeded Partner or Investor. Open **Organisation workspace**. Check its organisation profile and approval status.
2. For a newly approved Partner/Investor account, submit its organisation profile first. Administrator approval is required before it can save an opportunity. A profile edit requires approval again.
3. In **My opportunities**, create an internal opportunity. Supply title, summary, description, category, sectors, stages, eligibility, benefits, preparation documents, delivery/location and a future deadline or rolling deadline. Save the draft, then **Submit for review**.
4. Switch to Content Manager, open `/dashboard/cms`, select **Opportunities**, and review the submitted opportunity. Use **Publish opportunity**. Reload the latest published site in the studio before making another full-site change.
5. Confirm it appears under `/opportunities`. Drafts and review submissions are absent publicly.
6. Use the seeded founder and open `/opportunities/demo-seed-grant`. Apply using its approved venture and at least 30 characters of motivation. The status appears and the application also appears in **My applications**. A duplicate active application is refused.
7. Use the Investor → **Applicants**. The seed-grant application is visible. Shortlist, then accept or reject it. The Partner cannot review this Investor-owned opportunity's applicants. Terminal decisions cannot be changed by the review buttons.
8. Return to the founder. Confirm the status is updated. Test withdrawal on a separate application.
9. Edit an owned opportunity. Saving returns it to draft and removes its public listing until review/publication again.
10. Create an external opportunity with an HTTPS organiser URL, review and publish it. The approved entrepreneur sees an explicit external link. Redirecting does not create an internal application receipt.

## 5. Mentor guidance and incubation

1. As Mentor, open **Mentor workspace** → **Mentor profile**. Save biography, expertise and availability including timezone. Check `/yem/mentors` for the updated profile.
2. As Founder, request guidance from that mentor. In the Mentor's **Mentorship requests**, accept/decline the assigned request. Other mentors cannot decide it.
3. As Founder, open **Incubation**, select the approved venture and submit goals. A second active application for that venture is blocked.
4. As Administrator, approve the pending incubation and assign an active mentor.
5. As that Mentor, open **Mentees & milestones**, add a milestone with progress notes, then expand the saved milestone and update it. Check **Validate milestone** after reviewing evidence.
6. As Founder, check the same progress under **Incubation**. The founder cannot validate it.
7. As Administrator, review active incubations. **Graduate incubation** remains disabled until at least one milestone exists and every milestone is validated. Graduate it, then confirm completed progress remains visible and can no longer be changed by the active-incubation editor.

## 6. Learning and completion records

1. As Learner, open `/learn`, choose a course and **Enroll**. Completion buttons become available only after enrollment.
2. Mark lessons complete. Refresh and confirm progress. Switch to the other learner to verify separate enrollment/progress.
3. Try issuing a completion record as Administrator before every lesson is complete; it must fail.
4. Complete the course, then use Administrator → **Certificates** to issue a record for that learner/course. A duplicate is refused.
5. Return to the learner dashboard and open **My completion records**. The verification page identifies it as a local demonstration, not an accredited qualification.

## 7. Full CMS publishing walkthrough

1. As Content Manager, open `/dashboard/cms`. Review module navigation, counts, saved drafts, contribution review and discussion moderation links.
2. In **Homepage & featured content**, edit a slide title. Give the change-set a meaningful name. Use **Preview** to check the slide. **Save draft**. Public home content remains unchanged at this point.
3. Use **Publish**. Open `/` and verify the title changed. Refresh: publication persists. Use **Reload latest published site** before starting an unrelated change.
4. In **Articles, stories & listings**, search a record, duplicate it, set a unique lowercase slug and edit its title/body/image. Save and publish; verify its public route. Archive it, publish and confirm removal publicly. Reload the studio and restore the archived record.
5. In **Pages, navigation & settings**, edit contact/social details and homepage visibility flags. Add `/pages/test-programme`, edit its sections, and add a navigation entry with that link. Save/publish and check desktop/mobile navigation and the new page. Existing public routes such as `/about` can receive heading overrides and additional sections.
6. Test **Courses**, **Lessons**, **Resource pathways**, **FAQs**, **Sidebar widgets**, **Media library & partners**, and **Terms & conditions**. References use stable IDs; use existing IDs shown by the field suggestions. URLs must be local asset paths or allowed safe links. Media management changes references; uploads are pending backend integration.
7. In **Events & workshops**, duplicate a session, edit its title, type, timezone, venue, future start/end and deadline. Use a host account ID and valid group/forum IDs, or retain the existing links. Publish and confirm the event appears in `/events`. Reserve a place as an approved role.
8. In **Community groups & forums**, rename a group/forum or update descriptions. Publish and verify existing memberships/discussions remain connected. Member rosters stay private until membership.
9. In **Revisions & audit**, restore an earlier revision. Confirm a new revision is created and the public content changes. Five latest snapshots are retained. Restoration is blocked if it would break current registrations/applications or capacities.
10. Open two CMS tabs. Publish from one, then try to save/publish the older draft in the other. It must show a stale-revision error. Reload the current site and reapply the intended edits. The same protection applies when an organisation changes its opportunity while an editor is working.
11. Check validation deliberately: missing featured ID, unsafe URL, duplicated slug, removed enrolled course, capacity below reservations. Publication must fail without changing the live site.
12. Contributions remain in `/dashboard/content`: author draft → submit for review → Content Manager publishes. This includes editorial business listings; administrator approval of venture/organisation identity stays in the administration queue.

## 8. Administration, privacy and responsive checks

- Administrator → **Users & roles**: assign a staff role, suspend another account, confirm it cannot sign in or mutate data, then restore it. Self-suspension/self-demotion is disabled.
- **Analytics & reports**: compare counts to current records and download the audit CSV. User-entered values are escaped for spreadsheet use.
- Guest and entrepreneur visits to `/dashboard/cms` show an access message. Changing a URL query to `tab=users` does not reveal administrative tools to another role.
- Forum/group visitors see member counts without names; joined members see compact names. Group activity remains a compact timeline.
- On mobile, portraits show plain pictures initially. Touch reveals name and animated actions; a second touch/action can navigate or play. Check keyboard focus too.
- Test approximately 390px, 768px and desktop widths: login cards, registration pathways, Benefits menu, filters, role cards, horizontally scrollable workspace tables and CMS navigation. Confirm account pages use the original YERH layout without authentication panel animations.
- Confirm story playback and external videos still respect the existing media consent behavior. The terms summary popup remains available in the footer.

## Automated checks and remaining manual work

```powershell
npm run test
npm run build
npm run format:check
```

Tests cover role/ownership restrictions, approval transitions, enrollment/certificates, opportunity applications, organisation review, incubation updates/graduation, migrations, CMS validation/revisions, community privacy, fixtures and page rendering for all roles. Render tests supplement interactive checks; they do not prove touch behavior or visual animation quality.

Chrome automation was stopped by the computer-use tool because it could not confidently determine the browser URL. The existing public page and navigation were inspected before that stop; complete the interactive and mobile walkthrough above manually. No claim of a fully completed browser E2E run is made.

Production integration still needs real authentication, API/database persistence, server-side access control, transactions, secure media/document uploads and notifications. Demo commands are deliberately enabled only under Vite development, and production builds do not offer local account/CMS mutations.
