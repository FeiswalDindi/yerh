import { NewsWidget } from './widgets/NewsWidget';
import { LinksWidget } from './widgets/LinksWidget';
import { PartnersWidget } from './widgets/PartnersWidget';
import { StatisticsWidget } from './widgets/StatisticsWidget';
import { SocialsWidget } from './widgets/SocialsWidget';
import { useCatalog } from '../../app/useCatalog';
export function HomeSidebar() {
  const { site } = useCatalog();
  return (
    <aside className="home-sidebar" aria-label="Sidebar widgets">
      <div className="home-hero-widgets">
        {site.homeSections.blogs !== false && <NewsWidget />}
        <LinksWidget />
      </div>
      {site.homeSections.partners !== false && <PartnersWidget />}
      <StatisticsWidget />
      <SocialsWidget />
    </aside>
  );
}
