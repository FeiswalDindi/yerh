import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, Linkedin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { TeamPortrait } from './TeamSection';
import './team.css';

export function TeamMemberPage() {
  const { memberId = '' } = useParams();
  const { team } = useCatalog();
  const [copied, setCopied] = useState(false);

  const members = team?.members ?? [];
  const member = members.find((entry) => entry.id.toLowerCase() === memberId.toLowerCase());
  const others = members.filter((entry) => entry.id !== member?.id);

  usePageTitle(member ? `${member.name} — YERH Team` : 'Team member');

  async function copyShareLink() {
    const shareUrl =
      typeof window !== 'undefined' ? window.location.href : `/about/team/${member?.id ?? ''}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      setCopied(false);
    }
  }

  if (!member) {
    return (
      <>
        <PageIntro
          eyebrow="Our Team"
          title="Team member not found"
          description="This profile link may have changed or been removed."
        />
        <section className="container section team-member-page">
          <div className="empty-state">
            <p>Browse our full team directory on the About YERH page.</p>
            <Link className="button" to="/about#our-team">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Our Team
            </Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="container section team-member-page">
        <nav className="team-member-back" aria-label="Team navigation">
          <Link className="text-link" to="/about#our-team">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Our Team
          </Link>
        </nav>

        <article className="team-member-hero">
          <div className="team-member-avatar-col">
            <TeamPortrait member={member} />
          </div>
          <div className="team-member-summary">
            <p className="team-role">{member.role}</p>
            <h1>{member.name}</h1>
            {member.positioning && <p className="team-member-positioning">{member.positioning}</p>}
            <div className="team-member-actions">
              <button
                type="button"
                className="button button-gold"
                onClick={() => void copyShareLink()}
              >
                {copied ? (
                  <>
                    <Check size={16} aria-hidden="true" />
                    Profile link copied
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden="true" />
                    Copy profile link
                  </>
                )}
              </button>
              {member.linkedinUrl && (
                <a
                  className="button button-outline"
                  href={member.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Linkedin size={16} aria-hidden="true" />
                  LinkedIn profile
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </article>

        <section className="team-member-bio-card" aria-labelledby="team-member-bio-title">
          <h2 id="team-member-bio-title">About {member.name}</h2>
          <p>{member.bio}</p>
        </section>

        {others.length > 0 && (
          <section className="team-member-related" aria-labelledby="team-member-more-title">
            <h2 id="team-member-more-title">More from the YERH team</h2>
            <ul className="team-grid" role="list">
              {others.slice(0, 3).map((peer) => (
                <li className="team-card" key={peer.id}>
                  <TeamPortrait member={peer} />
                  <h3>{peer.name}</h3>
                  <p className="team-role">{peer.role}</p>
                  <Link
                    className="team-profile-trigger text-link"
                    to={`/about/team/${encodeURIComponent(peer.id)}`}
                  >
                    View full profile <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </>
  );
}
