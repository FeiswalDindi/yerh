# YERH · Youth Entrepreneurship Resource Hub

YERH helps young founders turn venture ideas into tested products. Visitors discover events and courses, verified guests can learn, and affiliated entrepreneurs take individual ventures through incubation with a mentor. Universities and hubs use YERH to follow their founders’ progress. High schools use it to organise physical classes, record students’ marks and request certificates from YERH.

**Develop on `yerh-laravel`.** This branch contains the React interface and the Laravel API that backs it. The `main` branch is the reference for the original frontend experience. Git deployments to Vercel are disabled in this branch’s [configuration](vercel.json).

## Set up a fresh laptop

### 1. Clone the branch and install dependencies

Install Git, Node.js 22.12 or newer, npm, Composer 2, PHP 8.2+ compatible with the Composer lockfile, and MySQL or MariaDB. On Windows, XAMPP supplies PHP and MariaDB. Make its PHP executable available on your PATH. Enable `pdo_mysql` for the app and `pdo_sqlite` for the Laravel tests. The examples below use PowerShell and start in the repository root after cloning. On macOS or Linux use `npm` and `cp` in place of `npm.cmd` and `Copy-Item`.

```powershell
git clone --branch yerh-laravel https://github.com/FeiswalDindi/yerh.git
cd yerh
git branch --show-current
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
composer --working-dir=backend install
npm.cmd --prefix frontend ci
php backend/artisan key:generate
```

The branch command should print `yerh-laravel`. Copy the templates and generate the app key once per fresh installation. Keep your private environment files and existing key when pulling updates.

### 2. Configure the database and select the wired UI

Start **MySQL** in XAMPP. Create an empty database named `yerh_db` in phpMyAdmin or run this statement through your local SQL client.

```sql
CREATE DATABASE IF NOT EXISTS yerh_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Edit the existing entries in **`backend/.env`**. Use the database port and credentials from your own installation. The example assumes an ordinary local XAMPP setup.

```dotenv
APP_ENV=local
APP_URL=http://127.0.0.1:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=yerh_db
DB_USERNAME=root
DB_PASSWORD=
QUEUE_CONNECTION=database
MAIL_MAILER=log
YERH_LOCAL_EMAIL_VERIFICATION=true
```

If the shared XAMPP database service cannot start, run `./scripts/start-local-database.ps1` from PowerShell. It uses XAMPP’s binaries to create and start a separate loopback MariaDB instance and creates `yerh_db` for you. Set `DB_PORT=3307` for that instance. Its data persists under `backend/storage/app/private/local-mariadb`. A teammate cloning the repository gets the schema and seed sources and creates their own local accounts and data.

In **`frontend/.env.local`**, enable the Laravel-backed account and dashboard before starting Vite or compiling the UI.

```dotenv
VITE_ENABLE_LARAVEL_ACCOUNT_DIALOG=true
```

### 3. Create the schema and starter content

```powershell
php backend/artisan config:clear
php backend/artisan migrate
php backend/artisan migrate:status
php backend/artisan db:seed --class=YerhCourseCatalogueSeeder
php backend/artisan db:seed --class=YerhEditorialCatalogueSeeder
```

Expect the migrations to show **Ran**. With the current seed sources, a fresh setup has two standalone courses, 21 editorial records and five marketplace categories. Category cards show zero listings until a product meets its publication requirements.

### 4. Run the app and create the first administrator

Run `npm.cmd run build:laravel` once to generate the interface Laravel serves on port 8000, including the account pages reached by email links. Then start each process in a separate terminal at the repository root.

| Terminal | Command | Purpose |
| --- | --- | --- |
| 1 | `php backend/artisan serve --host=127.0.0.1 --port=8000` | Laravel API and session handling |
| 2 | `npm.cmd run dev` | React development server with hot reload and an API proxy |
| 3 | `php backend/artisan queue:work database --tries=3` | Process queued invitations, mail and notifications |

Open the [Laravel-served site](http://127.0.0.1:8000) for the first account walkthrough. Use the [Vite development site](http://127.0.0.1:5173) for hot reload while editing React. The [API health check](http://127.0.0.1:8000/api/v1/status) should return `{"status":"ok"}`. Use `127.0.0.1` consistently for cookies and verification links. If Vite’s port is occupied, run `npm.cmd run dev -- --port 5182` and open that port.

1. Register a test account, sign in under **YERH**, and open **Account → Verify email address**. The local verification shortcut requires the local environment, log mailer, explicit verification flag and a loopback request. The normal email flow also works with the local log transport and queue worker.
2. Promote that verified, active guest using the email you actually registered. This local bootstrap command works while the database has no platform administrator.

   ```powershell
   php backend/artisan yerh:bootstrap-admin developer@example.test
   ```

3. Refresh the account and open the dashboard. Under **Institution directory**, create a test university or hub. Open **Manage institution → Intake → Activate institution**. It should appear as a sign-in choice. In **Agreements → View**, inspect the programme terms. Signed documents can be added separately.
4. In a second browser profile, register and verify another guest. Apply for affiliation with the active institution. Approve the application in the admin’s **Approval queue**, then refresh the guest’s account. The new entrepreneur should be able to submit a venture, choose a marketplace sector and see the admin’s review decision.

If you see fictional demo accounts, check the frontend flag and restart Vite or rebuild the Laravel UI. If the API responds but port 8000 shows a missing-UI message, use the Vite address or build the Laravel bundle. For the rest of the role-by-role acceptance tests, follow the [Laravel walkthrough](docs/LARAVEL_WORKSPACE.md#test-locally).

## Who does what

| Actor | How they participate |
| --- | --- |
| Public visitor | Browses public resources, events, courses and eligible marketplace listings. Registers to take part in account-based activities. |
| Guest | Has an account page, attends events and takes standalone courses. Can apply for university or hub affiliation. A rejected applicant can correct and resubmit. |
| Youth entrepreneur | Gains access through an approved affiliation or by accepting a valid university or hub invitation with the matching verified account. Creates and resubmits ventures, adds products, works through incubation, requests eligible credentials and applies for opportunities. Each venture has its own pathway. |
| Mentor | Reviews assigned founders’ evidence, records review meetings, opens exams and grades submissions. Can propose a standalone course with supporting documents, build lessons after approval and earn royalties on confirmed enrolments. |
| University or hub administrator | Works within the assigned institution. Managing staff invite members and follow each founder’s ventures, stages, payments and credentials. Members sign in individually and do their own coursework. |
| High-school administrator | Maintains the student roster, cohorts and teams, records classes and individual marks, requests certificates, and downloads issued credentials. School teams work independently of platform mentors. |
| High-school student | Attends physical classes and works in a team. The school maintains a roster record for each student. Individual results and certificates belong to the student. There is no student portal login. School team products stay outside the public marketplace. |
| Institutional contact with view access | Uses an individual account to inspect the assigned institution’s records. The institution shares a workspace across staff. The `view` and `manage` grants distinguish oversight from data entry. |
| Platform administrator | Activates institutions, assigns eligible staff and mentors, reviews affiliation and venture submissions, moderates listings, configures fees, confirms payments and issues or returns certificate requests. Also manages courses, events, opportunities and editorial access. |
| Content manager | Uses Content Studio to prepare, publish, feature and archive editorial material. |
| Partner and investor | The original frontend defines organisation profiles and participation for these roles. Their dedicated workflows are still fixture-backed. Treat new Laravel support for either as an integration task. |

**Progression and certification are separate decisions.** The stages are Getting Started, Intermediate / Advanced, and Funding (Aid). Recording an assessment completes the stage even below the 50% benchmark. A founder can proceed while certificate payment or admin review is pending. The final venture credential requires all three assessments. Individual founders receive achievement certificates. High-school certificates use the recorded score for First Class (70%+), Second Class Upper (60–<70%), Second Class Lower (50–<60%) or Completion (below 50%).

## How YERH earns revenue

| Payer and offer | What the payer gets | How the branch handles it |
| --- | --- | --- |
| **Institutions — negotiated programme agreements** | A school can run a cohort and issue individual results. A university or hub can enrol and follow its founders. | YERH agrees scope and price offline. Admins manage the institution and store signed agreements. Per-cohort pricing or a term renewal can be agreed commercially. Recurring billing and institutional invoicing would need additional implementation. |
| **Guests and entrepreneurs — standalone courses** | Access to published lessons, completion tracking and an admin-issued credential. | An admin sets the price and discount. A paid enrolment opens after payment confirmation. Each enrolment captures its price and royalty rate. Mentor royalty accrual equals the confirmed enrolment price multiplied by that rate. Payouts are a separate integration. |
| **Individual founders — stage certificates** | A credential for assessed work, with the option to continue learning while it is processed. | Default fees are KES 500 for Getting Started and KES 750 for Intermediate / Advanced. Admins can change them. The Funding and final venture credentials are free. School credentials follow the institutional agreement workflow. |
| **Individual ventures — early marketplace listing** | A founder can seek public visibility before completing incubation. | The default listing fee is KES 1,000. Publication requires a confirmed payment, an approved venture and listing, and an eligible active institution. Graduates can qualify through approved product evidence. A product added after graduation gets a targeted review. |

Payment references and admin decisions are stored in Laravel. Automatic collection, reconciliation and royalty transfers need a payment provider. The marketplace sells listing visibility; it currently has no buyer checkout or sales commission. The proposed Moodle lesson preview and quarter-course paywall are future work. Today, paid standalone courses use upfront confirmation.

## How the pieces connect

A founder submitting a venture is a useful example to trace. The React form gets its sector options from the marketplace catalog. Its repository sends the submission to Laravel with the signed-in session and CSRF token. Laravel checks the founder’s affiliation, validates the sector and writes the venture to MySQL. The admin queue reads that same record. An approved venture can enter incubation; approval alone does not publish its products.

| If you are changing… | Start here |
| --- | --- |
| URL, dashboard layout or form | [React routes](frontend/src/app/routes.tsx), [dashboard components](frontend/src/features/dashboard/) and [Laravel-backed workspace screens](frontend/src/features/platform/server/). Preserve the navigation, labels and interaction patterns used by the existing frontend. |
| A request or response | [Frontend service repositories](frontend/src/services/) and the [shared Laravel client](frontend/src/services/laravel-api.ts). Match the corresponding [Laravel route file](backend/routes/) and [controller](backend/app/Http/Controllers/). `identity.php` covers accounts and invitations, `workspace.php` covers affiliations and ventures, `programme.php` covers incubation and marketplace, and `schools.php`, `learning.php` and `engagement.php` cover their respective workflows. |
| Eligibility, prices, publication or stage progression | [Backend domain rules](backend/app/Domain/) and [frontend domain models](frontend/src/domain/). The API enforces role, institution scope and ownership for reads and writes. Keep those checks on the server even when the UI hides an action. |
| Persistent data or startup content | [Migrations](backend/database/migrations/), [seeders](backend/database/seeders/) and [source data](frontend/src/mocks/data/). Keep the frontend and backend directories together. The curriculum, fee defaults and some seeders read this source data by relative path. Operational records belong in the database. |
| External learning or messaging | [Course catalog contract](backend/app/Contracts/Learning/CourseCatalog.php), [Moodle adapter](backend/app/Integrations/Moodle/) and [Laravel notification classes](backend/app/Notifications/). The Moodle adapter reads a course catalog. Local enrolment and progress work in Laravel. Live account mapping, completion sync and official Moodle mobile app testing remain integration work. Use the queue worker and the configured mail transport for queued delivery. |

Public pages combine curated source content with published Laravel editorial records. The demo uses separate frontend repositories and fixtures. Community discussions and networking are still fixture-backed. When tracing a screen, first check which component its route selects in Laravel mode.

## Making a change and handing it back

1. Start from an up-to-date `yerh-laravel` checkout and create a topic branch for your improvement. Target `yerh-laravel` when opening the pull request. Read the [project collaboration rules](AGENTS.md) before editing.
2. Trace one complete user action from screen to service, route, controller and storage. Reuse the existing workspace controls and domain rules. When changing an API contract, update the caller and exercise the workflow from both roles, including another institution’s access boundary.
3. For schema changes, add a forward migration and handle existing records. Preserve applied migrations and local data. Keep private environment files, agreement uploads, database files, dependencies, generated UI bundles and runtime logs out of Git. The legacy importer writes a staging layout; review its output before merging content into `frontend/`.
4. Run the checks below. The Laravel suite uses in-memory SQLite; also exercise the changed workflow against local MySQL/MariaDB. In the pull request, identify the affected roles, migrations and exact steps a reviewer can use to reproduce the result.

```powershell
npm.cmd run check
npm.cmd run format:check
Push-Location backend
php artisan test
Pop-Location
```

Use the [Laravel acceptance guide](docs/LARAVEL_WORKSPACE.md#test-locally) for the wired flows. The [frontend sprint walkthrough](docs/TESTING_SPRINT.md) and [incubation walkthrough](docs/INCUBATION_TESTING.md) explain the original demo experience when comparing UI behaviour.
