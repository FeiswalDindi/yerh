# Laravel workspace

## Application boundaries

React and Vite own the existing UI and browser routes. The Laravel API begins under `/api/v1`, with `GET /api/v1/status` providing a basic process check. In development, Vite proxies `/api`. To target a different local Laravel address, set `LARAVEL_DEV_URL` in `frontend/.env`. The Laravel-served build preserves direct links and refreshes by serving the SPA entry for frontend routes. Existing fixture media URLs resolve to the generated UI assets.

The dashboard workspace selects a permitted screen and passes it the relevant data. Institutions, courses, incubation, mentors, partners, ventures and platform administration live in their own feature folders. The institution directory, portal, access management, classes and agreements can be changed independently. Domain rules and repositories continue to live outside UI components.

When connecting a workflow, add Laravel authorization, validation and transactions for that workflow. Replace its mock repository calls with the API only when the complete role workflow can be tested. Keep stable feature URLs and existing mock fixtures during the migration.

## Database

Use the MySQL family for YERH. MySQL and PostgreSQL can both model institutions, memberships, ventures, stage results, payments and certificates. Use unique constraints, foreign keys and transactions for those records in either engine. MySQL has the practical advantage here because the developer already operates the MySQL-compatible XAMPP environment. PostgreSQL would make sense if a future feature needed its specialized querying or indexing capabilities.

The installed XAMPP database is MariaDB 10.4.32. Laravel 12 runs on the installed PHP 8.2.12. Before hosting YERH, move to a supported PHP release and upgrade Laravel. Use a supported MySQL release such as MySQL 8.4 LTS or a supported MariaDB release. Keep database migrations valid on the engine chosen for production and verify them there before deploying. See the [Laravel database support matrix](https://laravel.com/docs/12.x/database), [Laravel release support policy](https://laravel.com/docs/13.x/releases) and [XAMPP database details](https://www.apachefriends.org/faq_windows.html).

## Moodle

Moodle remains a separate application with its own database, users and mobile web services. YERH owns affiliation, ventures, fees, marketplace and certificates. Moodle owns course content and activity completion. Map YERH enrolments to Moodle using stable identifiers and call Moodle's published web services. Institution-managed high-school students continue through the school's offline workflow.

The `CourseCatalog` contract has a read-only `MoodleCourseCatalog` implementation tested against simulated Moodle responses. Configure `MOODLE_URL` and `MOODLE_TOKEN` in Laravel's private environment when a site is available, with a dedicated Moodle service limited to the methods YERH needs. UI catalogue replacement, account mapping, enrolment and completion sync await a Moodle instance and Laravel authentication. Keep Moodle's official mobile web services enabled and test sign-in, enrolment and progress in the official app before rollout. Moodle 5.2 requires PHP 8.3+, MySQL 8.4+, MariaDB 10.11+ or PostgreSQL 16+ as applicable. See [Moodle 5.2 requirements](https://moodledev.io/general/releases/5.2) and [Moodle External Services](https://moodledev.io/docs/5.2/apis/subsystems/external).

## Notifications

Laravel owns queued mail and in-app notification delivery. The first reusable notification handles an issued course certificate. It waits for the transaction to commit, then writes to the notification inbox and sends through the configured mail transport. In the local environment, messages use Laravel's log mailer. Run `php backend/artisan queue:work` from the repository root when exercising queued server workflows. Wire the notification to the real certificate issuance command when moving that workflow to Laravel. The current demo does not dispatch real email.

Use separate notification classes for invitation, approval and payment events as their server workflows go live. Keep recipient selection in the authorized workflow and pass committed references to the notification. Test retries and deduplication for each workflow where sending twice would cause a problem. See [Laravel Notifications](https://laravel.com/docs/12.x/notifications) and [Laravel Queues](https://laravel.com/docs/12.x/queues).

## Migration order

1. Account sign-in, email verification, roles and institution membership. Verify the guest-to-entrepreneur flow, university and hub invitations, and school admin access.
2. Ventures and products, including ownership, institution boundaries, approvals and marketplace publication.
3. Incubation and certification. Verify the individual mentor workflow and the school results and certificate workflow independently.
4. Standalone course enrolment and Moodle progress, followed by course certificate issuance and its notifications.
5. Remaining payments, events, opportunities, community and CMS workflows. Move each through its existing acceptance checks.
