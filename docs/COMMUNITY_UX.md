# Membership, story interactions and terms

## Membership presentation

Group and selected-forum member rosters always expose a count. Names are rendered only when the current account belongs to that group/forum; administrators do not receive an automatic display override. Joined rosters contain linked names without biographies, roles, locations or profile cards. The first 12 names appear initially, with an expand control for longer lists.

Forums now carry optional `memberIds` alongside the existing group membership records. New fixtures define them explicitly in `mocks/data/community.json`. For saved version-2 data that predates this field, the forum inherits its linked group's roster until the first explicit forum membership action materializes its own list. This preserves existing browser edits without resetting the demo. Forum joins/leaves change only that forum and account; they do not alter group membership, points or existing discussion authorship. Stored duplicate or unknown member IDs are rejected.

Public discussion authors and session hosts remain attributed as before. The membership restriction applies to rosters. Group-page activity is shown to joined members; outsiders receive a join prompt. Activity uses compact icon/title/member/time rows, category filtering, and batches of ten updates. Reply text is represented by a link to the discussion, without rendering comment bodies or large cards. The same timeline is used for the Groups activity scope on member profiles.

These are frontend presentation rules over fictional data. A backend must return counts to non-members, omit roster identities from their responses, and authorize roster/activity queries server-side. It must not send private member records and rely on CSS or this component to hide them.

## Story portraits and card surfaces

`features/home/StoryPortrait.tsx` owns the reveal behavior. Resting portraits show only the image. Mouse entry, an image tap, or keyboard focus reveals the existing animated actions and caption. Mouse exit, an outside tap, focus leaving the card, or Escape dismisses them. Hidden actions are removed from the tab order; the image reveal control remains keyboard accessible. Tapping a portrait reveals its actions without navigating or starting a video. Video playback retains the existing dialog and cookie preference behavior.

The unconditional mobile/`hover: none` overlay rules were removed. Reveal styles follow explicit component state, avoiding sticky simulated hover on touch devices. Existing reduced-motion support remains in place.

`--yerh-card-surface` and `styles/surfaces.css` provide a shared light-grey background for content, community, dashboard and sidebar cards. White page backgrounds, photo surfaces, selected states and navy/gold brand callouts retain their intended treatments.

## Terms

The ten sections and effective date (19 August 2026) were imported from `feiso/youth-venture-spark/src/pages/TermsOfService.tsx` into `mocks/data/terms.json`. The mock content repository exposes the document through `Catalog.terms`; the popup and full page use that same fixture. Source instructions were not treated as implementation requests.

The footer Terms & Conditions button opens a native modal summary. Close, Escape and backdrop clicks dismiss it; Read more navigates to `/terms`. The dialog supports keyboard focus containment, background scroll locking and an independently scrollable summary with persistent action buttons. It does not record acceptance or replace the cookie preference workflow. The full page renders all imported sections, Privacy Notice links and the source contact email, with a note distinguishing local demo capabilities from connected platform services.

## Verification

Tests cover authenticated forum membership, independent group/forum transitions, legacy compatibility, invalid stored rosters, member/outsider rendering, absence of large member cards and reply bodies, resting portrait state, and the imported terms/summary. The compact group roster and activity layout, modal summary and full terms route were observed in local Chrome. Touch-device interaction was not directly exercised because user input was active in that browser. Run `npm run check` and `npm run format:check` for the automated checks.
