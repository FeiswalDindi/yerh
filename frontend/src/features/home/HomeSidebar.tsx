import type { ReactNode } from 'react';
import { NewsWidget } from './widgets/NewsWidget';
import { LinksWidget } from './widgets/LinksWidget';
import { PartnersWidget } from './widgets/PartnersWidget';
import { StatisticsWidget } from './widgets/StatisticsWidget';
import { SocialsWidget } from './widgets/SocialsWidget';
import { useCatalog } from '../../app/useCatalog';
import { normalizeHomeSidebarOrder, type HomeSidebarWidgetKey } from '../../domain/site';

export function HomeSidebar() {
  const { site } = useCatalog();
  const order = normalizeHomeSidebarOrder(site.homeSidebarOrder);

  const widgets: Record<HomeSidebarWidgetKey, ReactNode> = {
    news: site.homeSections.blogs !== false ? <NewsWidget key="news" /> : null,
    links: site.homeSections.links !== false ? <LinksWidget key="links" /> : null,
    partners: site.homeSections.partners !== false ? <PartnersWidget key="partners" /> : null,
    statistics:
      site.homeSections.statistics !== false ? <StatisticsWidget key="statistics" /> : null,
    socials: site.homeSections.socials !== false ? <SocialsWidget key="socials" /> : null,
  };

  return (
    <aside className="home-sidebar" aria-label="Sidebar widgets">
      {order.map((key) => widgets[key])}
    </aside>
  );
}
