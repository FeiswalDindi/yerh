import { usePageTitle } from '../../shared/usePageTitle';
import { FeatureCarousel } from './FeatureCarousel';
import { HomeSidebar } from './HomeSidebar';
import { StoriesSection } from './StoriesSection';
import { BusinessesSection } from './BusinessesSection';
import { UpdatesSection } from './UpdatesSection';
import { useCatalog } from '../../app/useCatalog';
/** Remove a section here without changing its siblings or their state. */
export function HomePage() {
  const { site } = useCatalog();
  usePageTitle('A place for your next big idea');
  return (
    <div className="homepage-wrapper">
      <div className="container home-split-container">
        <div className="home-main-content">
          <FeatureCarousel />
          {site.homeSections.stories !== false && <StoriesSection />}
          {site.homeSections.businesses !== false && <BusinessesSection />}
          {site.homeSections.updates !== false && <UpdatesSection />}
        </div>
        <HomeSidebar />
      </div>
    </div>
  );
}
