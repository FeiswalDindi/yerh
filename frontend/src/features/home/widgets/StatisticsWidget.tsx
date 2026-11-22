import { useCatalog } from '../../../app/useCatalog';
export function StatisticsWidget() {
  const { homepage } = useCatalog();
  return (
    <>
      {/* 4. Our Numbers */}
      <section className="sidebar-widget widget-our-numbers">
        <h3 className="sidebar-heading">Our Numbers</h3>
        <div className="numbers-grid">
          {homepage.statistics.map((stat) => (
            <div className="number-stat" key={stat.label}>
              <span className={`number-val stat-${stat.tone}`}>{stat.value}</span>
              <span className="number-lbl">{stat.label}</span>
            </div>
          ))}
        </div>
        <small>{homepage.statisticsNote}</small>
      </section>
    </>
  );
}
