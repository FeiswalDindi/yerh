import { DemoCatalogOverlay } from './DemoCatalogOverlay';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ContentProvider } from './ContentProvider';
import { createYerhRoutes } from './routes';
import { DemoProvider } from './DemoProvider';
import { LaravelSessionProvider } from './LaravelSessionProvider';
import { laravelModeEnabled } from '../config/laravel';
import { laravelContentRepository } from '../services/laravel-content-repository';
const router = createBrowserRouter(createYerhRoutes());
export function App() {
  const app = (
    <DemoProvider>
      <ContentProvider repository={laravelModeEnabled ? laravelContentRepository : undefined}>
        <DemoCatalogOverlay>
          <RouterProvider router={router} />
        </DemoCatalogOverlay>
      </ContentProvider>
    </DemoProvider>
  );
  return laravelModeEnabled ? <LaravelSessionProvider>{app}</LaravelSessionProvider> : app;
}
