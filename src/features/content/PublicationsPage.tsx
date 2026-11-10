import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, FileText, Users } from 'lucide-react';
import { useCatalog } from '../../app/useCatalog';
import { PageIntro } from '../../shared/PageIntro';
import { SectionHeading } from '../../shared/SectionHeading';
import { ContentCard } from './ContentCard';
import { usePageTitle } from '../../shared/usePageTitle';
export function PublicationsPage() {
  const { items } = useCatalog();
  usePageTitle('Publications');
  return (
    <>
      <PageIntro
        eyebrow="Publications"
        title="Stories, ideas, and knowledge to build on."
        description="Your home for success stories, blogs, research, and reports from the YERH community."
      />
      <section className="container section">
        <div className="collection-grid">
          {[
            {
              title: 'Success Stories',
              kind: 'story',
              href: '/publications/stories',
              icon: Users,
              text: 'Meet the people behind the possibilities.',
            },
            {
              title: 'Blogs',
              kind: 'article',
              href: '/publications/blogs',
              icon: BookOpen,
              text: 'All news, insights, and practical perspectives.',
            },
            {
              title: 'Reports & Briefs',
              kind: 'publication',
              href: '/publications/reports',
              icon: FileText,
              text: 'Research, advocacy, and project impact.',
            },
          ].map(({ title, kind, href, icon: Icon, text }) => (
            <Link className="collection-card" key={href} to={href}>
              <Icon size={30} />
              <span className="eyebrow">
                {items.filter((i) => i.kind === kind).length} in the collection
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
              <ArrowUpRight size={22} />
            </Link>
          ))}
        </div>
        <div className="section">
          <SectionHeading title="Explore the blogs" link="/publications/blogs" label="All blogs" />
          <div className="content-grid">
            {items
              .filter((i) => i.kind === 'article')
              .slice(0, 3)
              .map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
