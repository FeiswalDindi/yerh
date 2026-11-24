let laravelWorkspacePromise: Promise<
  typeof import('../features/platform/server/LaravelWorkspacePage')
> | null = null;

let dashboardLayoutPromise: Promise<typeof import('../features/dashboard/DashboardLayout')> | null =
  null;

/** Cached lazy loader for Laravel account & dashboard workspace chunks. */
export function loadLaravelWorkspace() {
  if (!laravelWorkspacePromise) {
    laravelWorkspacePromise = import('../features/platform/server/LaravelWorkspacePage').catch(
      (error) => {
        laravelWorkspacePromise = null;
        throw error;
      },
    );
  }
  return laravelWorkspacePromise;
}

/** Cached lazy loader for demo dashboard layout chunk. */
export function loadDashboardLayout() {
  if (!dashboardLayoutPromise) {
    dashboardLayoutPromise = import('../features/dashboard/DashboardLayout').catch((error) => {
      dashboardLayoutPromise = null;
      throw error;
    });
  }
  return dashboardLayoutPromise;
}

/** Preloads the target account/dashboard chunk in the browser without throwing on network errors. */
export function preloadAccountRoute(useLaravel: boolean): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const pending = useLaravel ? loadLaravelWorkspace() : loadDashboardLayout();
  return pending.then(
    () => undefined,
    () => undefined,
  );
}
