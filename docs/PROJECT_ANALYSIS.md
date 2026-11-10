> Historical initial audit. See FEATURE_AUDIT.md for the completed navigation/community update and current feature coverage.

# Source analysis and migration decisions

Analysis date: 7 November 2026.

## 1. What the Downloads project actually contained

`C:\Users\user\Downloads\yerh-front-end` was an HTTrack-style offline mirror, not an editable frontend application. Its root contained the mirror launcher, crawl logs/cache, copied third-party hosts, and a `yerh-kenya.kcau.ac.ke` subtree. There was no TypeScript build system or application-level component architecture.

The verified inventory contains **2,310 files / 304,061,822 bytes**, including **1,051 HTML files**, **368 CSS files**, and **171 JavaScript files**. A large file count does not represent the same number of original screens: many files are feeds, query-string variants, archive listings, generated WordPress data, cached embeds, and duplicate outputs.

The captured site combines WordPress, the OneCommunity theme, Elementor, BuddyPress-style member/group/community areas, WooCommerce business listings, and Eventin events. Copying this output into TSX would preserve plugin coupling, duplicated styles, unreachable server actions, and obsolete runtime dependencies. This migration instead extracts the meaningful public content and rebuilds the interaction model in React.

## 2. What Feiso contributes

`C:\Users\user\Desktop\feiso\youth-venture-spark` is already a React/TypeScript application, using Vite, React Router, React Query, Supabase-backed hooks, Tailwind, and a large component collection. Its `YerhApp.tsx` composes public, learning, and platform route groups. The public app includes landing/about/contact, authentication, applications, blogs, opportunities, marketplace previews, and legal/help pages. Learning routes cover resources, courses, events, progress/certificates, and associated admin pages. Platform routes cover entrepreneurs, mentors, ventures, networking, and other protected workflows.

This existing app is therefore the likely future host, not a source of backend code to duplicate into a new public frontend. Its credentials, database migrations, auth state, and private dashboards were not copied.

Brand evidence comes from `src/styles.css`:

| Token      | Source value | New location                  |
| ---------- | ------------ | ----------------------------- |
| KCAU navy  | `#192C57`    | `--yerh-navy`                 |
| KCAU gold  | `#CBAE2D`    | `--yerh-gold`                 |
| Surface    | `#f8f8fc`    | `--yerh-surface`              |
| Accent     | `#f5f0e0`    | `--yerh-gold-light`           |
| Typography | Jost         | locally bundled variable font |

Feiso has an OKLCH progressive override that changes the effective colors in supporting browsers. This frontend intentionally uses the explicit named KCAU HEX brand values consistently. Feiso’s YERH logo and its partner logos were reused with source hashes recorded.

Contact information uses Feiso’s `src/config/site-contact.ts` fallback values. Social links use the actual project-specific destinations in the reference site rather than Feiso’s generic social homepage fallbacks.

## 3. Reference layout and resulting design

The live [YERH Kenya website](https://yerh-kenya.kcau.ac.ke/) was inspected in a browser alongside its local mirror. Its desktop home page pairs a large rotating feature area with a numbered entrepreneurship news feed. Lower sections include My Story, Featured Businesses, Updates, Important Links, partners, social embeds, and a footer. [yerh.org](https://yerh.org/) could not be fetched by the web retrieval tool; the local Feiso checkout was the available source for that application’s structure and brand.

The new design retains the reference’s editorial hierarchy and resource focus:

1. Compact utility bar and clear primary navigation.
2. Large photographic feature carousel beside a numbered news feed.
3. Direct paths to learning, mentorship/community, and stories.
4. Partner strip and filterable entrepreneur stories.
5. Learning-resource feature, business directory, and publications.
6. Consistent calls to action and a complete footer.

It uses Feiso’s colors, square geometry, generous spacing, real local imagery, and readable Jost typography. Auto-advancing slides, embedded social trackers, counters with unverified impact statistics, and decorative fake events were not imported.

## 4. Content decisions

The public content catalogue contains:

| Kind                                    | Records |
| --------------------------------------- | ------: |
| News / articles                         |      11 |
| Entrepreneur and developer stories      |       7 |
| Business profiles                       |       4 |
| COPYEK publications                     |       3 |
| Past events                             |       2 |
| Total catalogue records                 |      27 |
| Additional foundational learning videos |       6 |

Each catalogue record carries its original path, canonical source URL, and source-file SHA-256. Article content is rendered as typed text blocks; executable HTML is never injected. Article pictures and videos are retained where present; records without a suitable editorial image use the clearly generic shared community photograph. Avatars, RSS icons, and plugin placeholders are not treated as article photography.

Some stories are primarily video, so their original YouTube links are preserved. The publication pages point directly to their original PDF URLs extracted from the old embedded PDF viewer. The mirror contained no `.pdf` files, so offline PDF availability is not claimed. Missing publication dates remain unspecified instead of being invented. Historic event text is retained and labelled as past material.

All other HTML is accounted for in `route-migration.json`. Public duplicates and taxonomy listings are archived; member/group/forum/activity records are marked as integration-dependent; WordPress infrastructure is archived. This is a deliberate public frontend migration, not a conversion of the old server-side CMS, member database, or administration interface.

## 5. Preservation and cleanup

All source files were added to a ZIP, checked for archive integrity, and read back to compare every SHA-256 before moving the new project to the requested Desktop location. The original file list and archive hash are retained in `source-inventory.json`. The new app includes only the minimal Vite HTML entry point and newly authored modular CSS; none of the 368 legacy stylesheets are loaded.

The old mirror remains recoverable from the complete archive. The Desktop Feiso checkout is unchanged. No production site was published or modified.

## Relocation — 9 November 2026

The new application and verified original ZIP were moved to `C:\Users\user\Desktop\yerh` at the user’s request. The Downloads source mirror and Desktop Feiso source were not removed or modified during this relocation.
