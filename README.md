# YERH

The `yerh-laravel` branch is the local development branch for the Laravel migration. The React application is in `frontend/` and the Laravel application is in `backend/`.

## Run locally with XAMPP

From the repository root, install frontend and Composer dependencies if needed:

```powershell
npm.cmd --prefix frontend ci
composer --working-dir=backend install
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Use Node 22.12+, Composer 2, and PHP 8.2+. Run `php backend/artisan key:generate` once for a fresh Laravel environment. Keep the existing key for a database with saved sessions or queued jobs.

The XAMPP Windows installation can serve `yerh_db` in either of these ways:

- If XAMPP **MySQL** starts normally, point `backend/.env` at its port and credentials, with `DB_DATABASE=yerh_db`.
- If the shared XAMPP service cannot start, use the same XAMPP binaries in a separate YERH-only instance. From the repository root run `./scripts/start-local-database.ps1`. In `backend/.env` use `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3307`, `DB_DATABASE=yerh_db`, `DB_USERNAME=root`, and an empty `DB_PASSWORD` for that loopback instance. It stores persistent local data in `backend/storage/app/private/local-mariadb`. Keep that directory when restarting or updating the app.

Review the resolved database name and port before running migrations. Run the normal forward migration:

```powershell
php backend/artisan config:clear
php backend/artisan migrate
php backend/artisan migrate:status
php backend/artisan serve --host=127.0.0.1 --port=8000
```

In a separate terminal, run `php backend/artisan queue:work database --tries=3` with `MAIL_MAILER=log` configured in `backend/.env`. In another terminal, run `npm.cmd run dev` and open [the local site](http://127.0.0.1:5173). If that port is in use, run `npm.cmd run dev -- --port 5182`. Vite proxies `/api` to Laravel. Keep the same hostname, `127.0.0.1`, for the UI and verification links.

Set `VITE_ENABLE_LARAVEL_ACCOUNT_DIALOG=true` in the private `frontend/.env.local` and restart Vite for the wired account and dashboard. Use `false` for the fixture walkthroughs. When compiling the local Laravel UI with `npm.cmd run build:laravel`, the same setting is built into the generated UI. See [local acceptance steps](docs/LARAVEL_WORKSPACE.md#test-the-wired-flow) for setup of the first administrator and the verification, approval and venture flows.

## Checks

```powershell
npm.cmd run check
npm.cmd run format:check
Push-Location backend
php artisan test
Pop-Location
```

Laravel tests use in-memory SQLite and fake the Moodle HTTP service and email delivery. The local app uses the database configured in `backend/.env`.

## Where to work

| Area | Location |
| --- | --- |
| Routes and feature UI | `frontend/src/app/routes.tsx`, `frontend/src/features/` |
| Role-specific dashboards | `frontend/src/features/platform/`, grouped by feature |
| Frontend business rules and data access | `frontend/src/domain/`, `frontend/src/services/` |
| Demo and future database seed source content | `frontend/src/mocks/data/` |
| Laravel endpoints and migrations | `backend/routes/`, `backend/database/migrations/` |
| Moodle adapter and queued notifications | `backend/app/Integrations/Moodle/`, `backend/app/Notifications/` |

See the [architecture and integration plan](docs/LARAVEL_WORKSPACE.md), [general acceptance walkthrough](docs/TESTING_SPRINT.md), and [incubation walkthrough](docs/INCUBATION_TESTING.md). Earlier architecture and validation notes record the original frontend layout.

The import tool in `scripts/import-legacy.py` writes its own staging layout. Merge reviewed output into the corresponding paths under `frontend/`. The local original-site archive remains outside Git.
