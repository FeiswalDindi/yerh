import { DemoCatalogOverlay } from './DemoCatalogOverlay';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ContentProvider } from './ContentProvider';
import { createYerhRoutes } from './routes';
import { DemoProvider } from './DemoProvider';
const router = createBrowserRouter(createYerhRoutes());
export function App() {
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
