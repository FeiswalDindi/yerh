import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { usePageTitle } from '../../shared/usePageTitle';
import { can } from '../../domain/roles';
export function MentorshipPage({ mode = 'mentors' }: { mode?: 'mentors' | 'mentees' }) {
  const { state, account, execute, enabled } = useDemo();
  const [selected, setSelected] = useState('');
  const [goal, setGoal] = useState('');
  const [success, setSuccess] = useState(false);
  usePageTitle(mode === 'mentors' ? 'YEM Mentor' : 'YEM Mentee');
  const mentors = state.accounts.filter((a) => a.role === 'mentor' && !a.suspended);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (execute({ type: 'request', id: crypto.randomUUID(), mentorId: selected, goal })) {
      setSuccess(true);
      setSelected('');
      setGoal('');
    }
  }
  return (
    <>
      <PageIntro
        eyebrow={`YEM · ${mode === 'mentors' ? 'Mentor' : 'Mentee'}`}
        title={
          mode === 'mentors'
            ? 'Experience worth sharing.'
            : 'A little guidance. A confident next step.'
        }
        description={
          mode === 'mentors'
            ? 'Explore the mentorship pathway and discover how experience can support another entrepreneur.'
            : 'Describe what you want to learn and try a local mentorship request with a demo account.'
        }
      />
      <section className="container section">
        <DemoNotice />
        <nav className="section-tabs" aria-label="Mentorship pathways">
          <Link to="/yem/mentors" aria-current={mode === 'mentors' ? 'page' : undefined}>
            Mentor
          </Link>
          <Link to="/yem/mentees" aria-current={mode === 'mentees' ? 'page' : undefined}>
            Mentee
          </Link>
          <Link to="/dashboard/mentorship">My mentorship requests</Link>
        </nav>
        {success && (
          <p className="form-success" role="status">
            Demo request saved. Switch to the mentor account to review it. No external request was
            sent.
          </p>
        )}
        <div className="resource-track-grid">
          <div>
            <h2>
              {mode === 'mentors'
                ? 'Help someone take their next step.'
                : 'Make your learning goal specific.'}
            </h2>
            <p className="section-copy">
              The original YEM menu linked to mentor and mentee application forms. Here you can
              explore both sides of the process using fictional profiles.
            </p>
            <ol className="checklist">
              <li>Choose an area where guidance would help.</li>
              <li>Describe the outcome you want to work toward.</li>
              <li>Review the request from the mentor’s workspace.</li>
            </ol>
            <Link className="button" to="/login">
              Try a different demo account
            </Link>
          </div>
          <div className="mentor-list">
            {mentors.map((mentor) => (
              <article className="collection-card" key={mentor.id}>
                <span className="eyebrow">FICTIONAL DEMO MENTOR</span>
                <h2>{mentor.name}</h2>
                <p>
                  {state.platform.mentors.find((p) => p.accountId === mentor.id)?.bio ?? mentor.bio}
                </p>
                {state.platform.mentors.find((p) => p.accountId === mentor.id) && (
                  <p className="mentor-availability">
                    <strong>Expertise:</strong>{' '}
                    {state.platform.mentors.find((p) => p.accountId === mentor.id)?.expertise}
                    <br />
                    <strong>Availability:</strong>{' '}
                    {state.platform.mentors.find((p) => p.accountId === mentor.id)?.availability}
                  </p>
                )}
                <div className="tag-list">
                  {mentor.skills.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
                <Link className="text-link" to={`/network/members/${mentor.id}`}>
                  View profile →
                </Link>
                {enabled && can(account, 'apply') ? (
                  <button
                    className="button"
                    onClick={() => {
                      setSelected(mentor.id);
                      setSuccess(false);
                    }}
                  >
                    Request demo guidance
                  </button>
                ) : (
                  <Link
                    className="text-link"
                    to={account?.role === 'mentor' ? '/dashboard/mentorship' : '/apply'}
                  >
                    {account?.role === 'mentor'
                      ? 'Review your assigned requests'
                      : 'Apply for entrepreneur access'}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
        {selected && (
          <form className="workspace-form" onSubmit={submit}>
            <h2>Your mentorship goal</h2>
            <label>
              What would you like help with?
              <textarea
                required
                minLength={10}
                maxLength={800}
                rows={4}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="button">Save demo request</button>
              <button type="button" className="text-link" onClick={() => setSelected('')}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
