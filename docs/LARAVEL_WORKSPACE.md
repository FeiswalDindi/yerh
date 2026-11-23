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

Laravel owns queued mail and in-app notification delivery. Issuing a standalone course certificate queues a notification after the transaction commits. The notification appears in the signed-in account's bell and goes through the configured mail transport. Local email uses the log transport, so the queue worker must be running to deliver the notification. Existing demo mode stays separate.

Use separate notification classes for invitation, approval and payment events as their server workflows go live. Keep recipient selection in the authorized workflow and pass committed references to the notification. Test retries and deduplication for each workflow where sending twice would cause a problem. See [Laravel Notifications](https://laravel.com/docs/12.x/notifications) and [Laravel Queues](https://laravel.com/docs/12.x/queues).

## Test locally

Use `http://127.0.0.1:8000` with the local Laravel build, or the current Vite
address if you are developing the interface. The Laravel server, database and
queue worker should be running. Use separate browser profiles for the different
roles so switching accounts does not replace the same session.

### Account verification and affiliation

1. Register a fictional guest and sign in under **YERH**.
2. In **Account**, select **Verify email address** beside **Resend verification**.
   The account displays **Email verified**. The button requires
   `APP_ENV=local`, `MAIL_MAILER=log`, an explicit
   `YERH_LOCAL_EMAIL_VERIFICATION=true`, and a loopback request. Other
   environments use the verification email.
3. In **Account**, apply to an active university or hub. Approve or reject the
   application from the platform administrator's **Approval queue**. An
   approval lets the guest open the entrepreneur dashboard and sign in under
   their approved institution. A rejected guest can correct and resubmit.

### Individual ventures, marketplace and certification

1. As an entrepreneur with an approved venture, open **Products** and add a
   product. Open **Incubation**, launch that venture and include the product.
2. As the administrator, use **Mentors → Add mentor** with a separate verified
   unaffiliated guest. Assign the mentor under **Incubation** and review the
   product under **Products**.
3. As the founder, save the evidence for each step and request stage review.
   The assigned mentor can leave feedback, record the review meeting and open
   the exam. Submit a response as the founder and grade it as the mentor.
   Every recorded mark advances the pathway, including a mark below 50%.
4. As the founder, record a test payment reference for a priced stage
   certificate. Confirm it under the administrator's **Payments** screen.
   Under **Certificates → Individual ventures**, issue the certificate.
   The funding and final certificates have no fee. The final certificate
   requires all three assessments.
5. Confirm that an approved product with approved pathway evidence can be
   published after graduation. For a newly added product, submit targeted
   evidence. For an early paid listing, record and confirm the listing fee,
   then approve the listing. Use unique fictional references when testing
   payment confirmation in the local environment.

### School and institutional portal

1. As the platform administrator, add a high school in **Institution directory**.
   Open **Manage institution → Intake → Activate institution** to make it available
   for sign-in. Assign a verified guest under **Staff & contacts**. Under
   **Agreements**, choose **View** for programme terms or **Add agreement** to upload
   a signed PDF. The school can download its documents under **Portal → Agreements**.
2. Sign in as that manager using the school option. Under **Portal → Students**,
   add fictional roster entries. These records have no sign-in accounts.
3. In **Portal → Cohorts**, add a cohort and select **View**. In **Team
   ventures**, add students to a team. Record a class under **Classes**.
4. Under **Results**, use the pencil beside a student's mark. Record 75% for
   one student and 45% for another, then verify both can receive a next-stage
   mark. Filter by team and export the matching rows if needed.
5. In the cohort's **Certificates** tab, choose the stage and select **Request
   all eligible**. As the platform administrator, open **Certificates →
   School requests**, approve one and return the other with a reason. As the
   school manager, open the issued certificate, and use **Print or save PDF**.
   The returned request displays the reason and can be resubmitted.
6. For a university or hub, sign in as its manager. **Portal → Members** shows
   affiliated members. **Invitations** manages onboarding and **Pathway
   progress** shows each venture's assessed stages, fees and credentials.

### Standalone courses

1. As a verified guest, open **Courses**, choose a general course and confirm
   that you want to enter its workspace. For a paid course, submit a unique
   fictional payment reference.
2. As the platform administrator, open **Courses → Enrolments & certificates**
   and confirm the payment. Reload the course as the guest and mark every
   lesson complete. The page displays **Course completed**.
3. As the administrator, issue the certificate in the enrolment registry.
   Reload the course as the guest to view it. The queued notification also
   appears in the signed-in account's bell after processing.
4. As a mentor, use **Course proposals** to submit a proposal with a fictional
   PDF. Approve it in the administrator's **Courses** workspace. The mentor can
   then add lessons. An administrator publishes the course and sets price,
   discount and royalty. Mentor royalties accrue on confirmed enrolments;
   disbursements require a separate payment integration.

### Events and opportunities

1. In the administrator's **Events**, create a category and add an event.
   Save as **Draft** and verify that **Preview** excludes it. Edit it to
   **Published** and verify it appears publicly. A future end date moves a
   previously archived event back to **Upcoming**. Verify that event
   reservations respect capacity and the registration deadline.
2. In the administrator's **Opportunities**, publish an internal listing.
   Sign in as an entrepreneur and apply with an approved venture. The
   administrator reviews it under **Applications**. The entrepreneur tracks
   the decision under **Opportunities → Applications**.

### Editorial content

In **Content Studio**, add a draft article, story, or report. Publishing makes
it visible from the public listing. Archiving takes it off the public site.
Choose to feature a published story to display it on the homepage.

## Remaining integrations and fixture surfaces

The local course workflow uses recorded enrolments and lesson completion.
Live Moodle account mapping, enrolment, completion sync and mobile app testing
still need a configured Moodle instance. The payment reference screens record
administrator confirmation. A payment provider is needed to collect and verify
money automatically. Outbound mail requires a configured transport.

Community discussion and networking remain in the fixture frontend and are
outside the test steps above.
