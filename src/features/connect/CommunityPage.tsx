import { ArrowUpRight, BookOpen, MessageCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
export function CommunityPage() {
  const { media } = useCatalog();
  usePageTitle('Community & mentorship');
  return (
    <>
      <PageIntro
        eyebrow="Community & mentorship"
        title="A good idea grows in good company."
        description="Find inspiration in shared experiences and discover how mentorship can support your entrepreneurial journey."
      />
      <section className="container section community-feature">
        <img src={media.team} alt="Young people sharing a workspace" />
        <div>
          <p className="eyebrow">CONNECTION MAKES A DIFFERENCE</p>
          <h2>
            Bring your questions.
            <br />
            Share your experience.
          </h2>
          <p>
            YERH brings aspiring entrepreneurs, business owners, and mentors into a shared space for
            learning. Whatever stage you’re at, there’s value in exchanging ideas with people who
            understand the journey.
          </p>
          <Link className="button" to="/join">
            Find your pathway
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="container purpose-grid section">
        {[
          {
            icon: Users,
            title: 'Explore mentorship',
            text: 'Connect with experience that helps you see your challenges from a different perspective.',
            href: '/join?role=mentee',
            action: 'I’m looking for guidance',
          },
          {
            icon: MessageCircle,
            title: 'Share what you know',
            text: 'Your experience can help another entrepreneur take a confident next step.',
            href: '/join?role=mentor',
            action: 'I’d like to mentor',
          },
          {
            icon: BookOpen,
            title: 'Learn alongside others',
            text: 'Explore practical resources and discover past workshops from the community.',
            href: '/events',
            action: 'Explore workshops',
          },
        ].map(({ icon: Icon, title, text, href, action }) => (
          <div key={title}>
            <Icon size={28} />
            <h3>{title}</h3>
            <p>{text}</p>
            <Link className="text-link" to={href}>
              {action}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        ))}
      </section>
    </>
  );
}
