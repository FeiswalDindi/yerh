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
  if (laravelModeEnabled) {
    return (
      <LaravelSessionProvider>
        <ContentProvider repository={laravelContentRepository}>
          <RouterProvider router={router} />
        </ContentProvider>
      </LaravelSessionProvider>
    );
  }
  return (
    <DemoProvider>
      <ContentProvider>
        <DemoCatalogOverlay>
          <RouterProvider router={router} />
        </DemoCatalogOverlay>
      </ContentProvider>
    </DemoProvider>
  );
}
