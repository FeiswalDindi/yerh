import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Linkedin, X } from 'lucide-react';
import type { TeamContent, TeamMember } from '../../domain/site';
import './team.css';

function TeamPortrait({ member }: { member: TeamMember }) {
  const [failedImage, setFailedImage] = useState('');
  const initials = member.name
    .replace(/^Dr\.\s+/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return (
    <span className="team-portrait" aria-hidden="true">
      {member.image && member.image !== failedImage ? (
        <img
          src={member.image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(member.image)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

function TeamProfileDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="team-profile"
      aria-labelledby={nameId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="team-profile-inner">
        <form method="dialog">
          <button
            className="team-profile-dismiss icon-button"
            aria-label="Close profile dialog"
            autoFocus
          >
            <X size={21} aria-hidden="true" />
          </button>
        </form>
        <TeamPortrait member={member} />
        <h2 id={nameId}>{member.name}</h2>
        <p className="team-role">{member.role}</p>
        <div className="team-profile-bio">
          {member.positioning && <h3>{member.positioning}</h3>}
          <p>{member.bio}</p>
          {member.linkedinUrl && (
            <a className="text-link" href={member.linkedinUrl} target="_blank" rel="noreferrer">
              <Linkedin size={16} aria-hidden="true" /> Connect on LinkedIn{' '}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          )}
        </div>
        <form method="dialog">
          <button className="button team-profile-close">Close profile</button>
        </form>
      </div>
    </dialog>
  );
}

export function TeamSection({ team }: { team: TeamContent }) {
  const heading = useId();
  const [profile, setProfile] = useState<TeamMember | null>(null);
  const [failedPhoto, setFailedPhoto] = useState('');
  if (!team.members.length) return null;

  return (
    <section id="our-team" className="team-section" aria-labelledby={heading}>
      <div className="container section">
        <header className="team-section-heading">
          <h2 id={heading}>{team.title}</h2>
          {team.intro && <p>{team.intro}</p>}
        </header>
        <ul className="team-grid" role="list">
          {team.members.map((member) => (
            <li className="team-card" key={member.id}>
              <TeamPortrait member={member} />
              <h3>{member.name}</h3>
              <p className="team-role">{member.role}</p>
              <button
                className="team-profile-trigger text-link"
                type="button"
                aria-haspopup="dialog"
                aria-label={`View profile for ${member.name}`}
                onClick={() => setProfile(member)}
              >
                View profile <ArrowRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {team.groupPhoto.image && team.groupPhoto.image !== failedPhoto && (
          <img
            className="team-group-photo"
            src={team.groupPhoto.image}
            alt={team.groupPhoto.alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailedPhoto(team.groupPhoto.image)}
          />
        )}
        {team.sourceUrl && (
          <div className="team-source">
            <a className="text-link" href={team.sourceUrl} target="_blank" rel="noreferrer">
              Official YERH team listing <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
      {profile && <TeamProfileDialog member={profile} onClose={() => setProfile(null)} />}
    </section>
  );
}
