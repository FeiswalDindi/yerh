import { ArrowDown, ArrowUpRight, BookOpen, Lightbulb, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { usePageTitle } from '../../shared/usePageTitle';
import { PageIntro } from '../../shared/PageIntro';
import { PartnerStrip } from '../home/PartnerStrip';
import { TeamSection } from './TeamSection';
export function AboutPage() {
  const { media, faqs, team } = useCatalog();
  const { hash } = useLocation();
  usePageTitle('About YERH');
  useEffect(() => {
    if (hash === '#our-team') document.getElementById('our-team')?.scrollIntoView();
  }, [hash, team]);
  return (
    <>
      <PageIntro
        eyebrow="About the hub"
        title="Turning entrepreneurial learning into action."
        description="A shared ambition: to help young people build sustainable, thriving enterprises."
      />
      <section className="container section about-grid">
        <img src={media.developers} alt="Members of the YERH development team" />
        <div>
          <p className="eyebrow">OUR STORY</p>
          <h2>
            Created with young people.
            <br />
            Built for possibility.
          </h2>
          <p>
            YERH was developed through the Co-Production for Youth Entrepreneurship in Kenya
            (COPYEK) project, a partnership between KCA University, the Youth Enterprise Development
            Fund, and the University of Nottingham.
          </p>
          <p>
            With support from the British Council’s Innovation for African Universities programme,
            the project set out to bridge the gap between entrepreneurship learning and
            entrepreneurship practice.
          </p>
          <p>
            The hub brings together knowledge, opportunities for mentorship, and the experiences of
            youth-owned enterprises, helping ideas move from possibility to practice.
          </p>
          <div className="about-story-links">
            <Link className="text-link" to="/publications">
              Explore the project’s publications
              <ArrowUpRight size={17} />
            </Link>
            {!!team?.members.length && (
              <Link className="text-link" to="#our-team">
                Meet our team <ArrowDown size={17} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </section>
      <section className="container purpose-grid">
        {[
          {
            icon: BookOpen,
            title: 'Learn with purpose',
            text: 'Practical knowledge and resources to build your confidence and business skills.',
          },
          {
            icon: Users,
            title: 'Connect with people',
            text: 'Discover the value of mentorship, shared experience, and a supportive community.',
          },
          {
            icon: Lightbulb,
            title: 'See what’s possible',
            text: 'Meet young entrepreneurs and learn from the journeys behind their businesses.',
          },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <Icon size={28} />
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
      {team && <TeamSection team={team} />}
      <PartnerStrip />
      <section id="faq" className="container section faq-section">
        <div>
          <p className="eyebrow">A LITTLE MORE CLARITY</p>
          <h2>
            Good questions.
            <br />A place to start.
          </h2>
          <Link className="text-link" to="/contact">
            Talk to the team
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="faq-list">
          {faqs.map(({ question, answer }) => (
            <details key={question}>
              <summary>
                {question}
                <span>+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
