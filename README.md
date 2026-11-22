# YERH

The `yerh-laravel` branch is the local development branch for the Laravel migration. The React application is in `frontend/` and the Laravel application is in `backend/`.

## Run locally with XAMPP

Use Node 22.12+, Composer 2 and PHP 8.2+. From the repository root, run:

```powershell
npm.cmd --prefix frontend ci
composer --working-dir=backend install
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

For a fresh `backend/.env`, generate the Laravel application key once:

```powershell
php backend/artisan key:generate
```

1. Start **MySQL** in the XAMPP Control Panel. XAMPP provides MariaDB under that label. Use its database client to create a `yerh` database with `utf8mb4`.
2. Create a local database user for YERH with schema privileges on `yerh`. Enter its credentials and the XAMPP port in `backend/.env`. The template uses the Laravel `mysql` connection on port 3306.
3. Run the migrations and start Laravel:

```powershell
php backend/artisan migrate
php backend/artisan serve --host=127.0.0.1 --port=8000
```

4. In another PowerShell window at the repository root, run `npm.cmd run dev` and open [YERH development](http://127.0.0.1:5173). Vite proxies `/api` to Laravel. Check [the API status through Vite](http://127.0.0.1:5173/api/v1/status) before opening [Demo accounts](http://127.0.0.1:5173/demo).
5. To test the compiled React app through Laravel, run `npm.cmd run build:laravel` and open [YERH served by Laravel](http://127.0.0.1:8000). The generated UI is written to `backend/public/ui`. The two ports have separate browser demo records.

The frontend can run by itself for fixture-based UI work. Start Laravel and the database when testing server features. The current demo sign-ins and dashboard activity still use browser storage. Only use fictional demo data.

## Checks

```powershell
npm.cmd run check
npm.cmd run format:check
php backend/artisan test
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
