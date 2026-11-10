# Validation record — 9 November 2026

## Automated

- 13 tests pass: canonical source routes/provenance, bundled media, search, all 12 video destinations, email encoding, navigation hierarchy, anonymous-write rejection, per-account learning/membership, mentorship ownership/duplicates, draft edit/review/publication permissions, moderation, malformed storage recovery, and fixture reference integrity.
- Strict TypeScript compilation passes with `noUncheckedIndexedAccess`, unused-symbol checks, and no implicit `any`.
- Vite production build succeeds with lazy page chunks and local fonts.
- Prettier source/test checks pass.
- Original archive was previously verified with ZIP integrity and SHA-256 read-back for all 2,310 files; this update does not alter the archive or supplied mirror.

## Browser verification

- Desktop Home dropdown exposes About Us and FAQ. Resources exposes all eight original entries and nested entrepreneurship topics. Keyboard ArrowDown opens submenus.
- Mobile (390×844 viewport) menu opens/closes and Publications exposes Success Stories, Blogs, Reports & Briefs. Inspected mobile workspace has no horizontal overflow.
- Entrepreneur login → create story draft → submit for review → switch to editor → publish → open the public story detail. Changes survive a full reload.
- Mentor login → assigned request → accept → accepted state displayed.
- Home navigation starts with Idea to Business. Observed automatic rotation to later cards. Old pagination bars/count are absent; pause and arrow controls are present.
- Provider/context modules were separated after hot reload exposed stale context instances; subsequent page edits and route transitions were verified without that failure.

Demo test contributions remain clearly labeled as local, fictional content. No live email, external account, payment, registration or mentorship submission was sent. Domain tests cover additional role boundaries that are not all repeated as browser clicks.

## Scope limits

The KCAU live endpoint timed out; feature recovery used the complete supplied mirror and screenshots. External media/documents retain original links and depend on their hosts. Production backend integration, real authentication, live member datasets, certification and event registration remain host responsibilities, documented in INTEGRATION.md.

Additional smoke checks: FAQ, advanced entrepreneurship, workshops, webinars, Learn, Forums, Network, YEM mentors and Publications all rendered with no horizontal overflow. The test-only contributions and request responses were reset through the demo UI after verification. Production browser preview on port 4173 was unreachable in the sandbox; production validation consists of compilation/build and the explicit DEV gate, not a browser session. Development port 5173 was verified and left running.

## Maintenance follow-up — 9 November 2026

After the user layout changes, `npm run check` passes all 16 tests, strict TypeScript and the production build. `npm run format:check` passes. Three added tests cover safe YouTube URLs, invalid consent values and fixture-driven homepage metadata.

Browser checks on development port 5173 verified desktop rendering, Essential Only blocking all video iframes, Accept All enabling the expected privacy-enhanced YouTube embed, video dialog focus/Escape dismissal, and the 390 x 844 mobile drawer focus loop/Escape/return focus. The closed drawer is inert and the mobile page has no horizontal overflow. Viewport override was reset after testing. Prior demo workflow checks above are historical; the existing domain tests were rerun, but that complete browser workflow was not repeated in this maintenance pass.

## Roles, benefits and CMS sprint — 10 November 2026

`npm run check` passed: 44 automated tests, strict TypeScript and the Vite production build. Coverage includes signup persistence, account-first applications/approval, ownership, organisation approval, opportunity applicant transitions, enrollment/completion records, incubation milestone updates/graduation, CMS revision conflicts/restoration, safe references and scoped page rendering. All new seeded records live in mock-data files.

Chrome's public-page/navigation state was inspected. Further interactive browser control stopped when the computer-use tool could not confidently verify the current URL. Animated form behavior, mobile touch interaction and the manual multi-role acceptance walkthrough remain user-verifiable; see [TESTING_SPRINT.md](TESTING_SPRINT.md). Authentication and mutation persistence remain development-only simulations pending backend integration.
