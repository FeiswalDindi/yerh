# Deployment

Development on `yerh-laravel` is local-only. This branch disables Vercel Git deployments in `vercel.json` and carries no GitHub Pages workflow. The earlier deployment and its branch are outside this migration.

Use the [local setup](../README.md) to run Laravel with a Vite dev server or build the UI into Laravel's ignored public build directory. Before a future server deployment, use Laravel's `backend/public` as the web root and configure a supported PHP stack, a separate database, scheduled jobs, a queue worker and HTTPS. Keep private environment files and Composer authentication outside Git.
