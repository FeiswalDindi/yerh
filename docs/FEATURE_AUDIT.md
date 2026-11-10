# Feature audit — November 2026 update

Sources: the supplied `yerh-front-end` mirror, its `#menu-primary-menu`, content pages, the two navigation screenshots, and the Feiso project. The live KCAU endpoint timed out during this audit; the offline mirror is the content source. Authentication-only data cannot be recovered from public HTML.

| Original feature                     | Updated implementation                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home → About Us, FAQ                 | `/about`, `/faq` nested beneath Home                                                                                                                                                   |
| Market Place                         | `/marketplace`, imported businesses with detail pages and search                                                                                                                       |
| Entrepreneurship → New Start-Ups     | `/entrepreneurship/startups`, six original videos and guides                                                                                                                           |
| Intermediate / Advanced Business     | `/entrepreneurship/advanced`, six additional original videos                                                                                                                           |
| General and Well-Being; Funding      | Dedicated topic views, checklists and relevant original resources. Old menu linked both to the generic resources page. New copy is editorial guidance, not recovered standalone pages. |
| Workshops                            | `/workshops`, original workshop/event records including cyber-security material                                                                                                        |
| Webinars                             | `/webinars`, original recorded video articles                                                                                                                                          |
| Forums                               | `/forums`, the original three forum categories, local topics/replies, admin hide/restore                                                                                               |
| Learn                                | `/learn`, two new structured pathways based on the 12 original videos; local progress. Original course listing was empty.                                                              |
| YEM → Mentor/Mentee                  | `/yem/mentors`, `/yem/mentees`, fictional mentor profiles, local guidance requests and responses. Original external application forms are not submitted.                               |
| YERH - Network                       | `/network`, local groups, member directory, profiles, activity, join/leave. Original group/member widgets were loading placeholders in the mirror.                                     |
| Success Stories, Blogs, Publications | Nested under Publications as stories, blogs, reports. Separate News & Insights removed; earlier URLs redirect to blogs.                                                                |
| Login/Register                       | Five development demo roles; registration is a pathway selector or configured host handoff. No fake credential registration.                                                           |
| Important links, partners            | Fixture-driven homepage links and partner strip                                                                                                                                        |
| Carousel                             | New initial Idea to Business card; four rotating cards with arrows/pause, no number or bars                                                                                            |
| Contact, saving, sharing             | Existing email-draft contact, browser bookmarks, copy-link sharing retained                                                                                                            |

11 blogs, 7 stories, 4 businesses, 2 event records, 3 reports, and 12 original video lessons are organized in mock fixtures. FAQs, curated homepage references, pathways, topic guidance, fictional community records and role accounts are separate fixture collections. Published local submissions join the public catalogue only while the demo is enabled.

## Deliberate limits

No original member data, private messages, working backend, payments, event registrations, course certificates or live mentorship sessions were supplied by the mirror. These are not claimed to be implemented as production services. Demo records are explicitly fictional and stay in localStorage. Historical events remain historical. External video/document links retain their original destinations and availability depends on their hosts.

Duplicated archive/taxonomy/feed/embed files and old plugin code remain in the original ZIP, rather than becoming duplicate frontend pages. See the per-file route migration map and inventory. The full archive remains unchanged.
