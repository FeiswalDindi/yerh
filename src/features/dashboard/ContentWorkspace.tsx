import { usePageTitle } from '../../shared/usePageTitle';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { PageIntro } from '../../shared/PageIntro';
import { DemoNotice } from '../demo/DemoNotice';
import { contentPath } from '../../domain/content';
import type { Submission } from '../../domain/demo';
export function ContentWorkspace() {
  usePageTitle('Content workspace');
  const { state, account, execute } = useDemo();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Community');
  const [kind, setKind] = useState<Submission['kind']>('story');
  const [editing, setEditing] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!account) return null;
  const canReview = ['content_manager', 'admin'].includes(account.role);
  const entries = state.submissions.filter((s) => s.ownerId === account.id || canReview);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      execute(
        editing
          ? { type: 'edit-submission', id: editing, title, body, category }
          : { type: 'submission', id: crypto.randomUUID(), title, body, category, kind },
      )
    ) {
      setEditing(null);
      setTitle('');
      setBody('');
      setSaved(true);
    }
  }
  return (
    <>
      <PageIntro
        eyebrow="Content workspace"
        title={canReview ? 'Help good ideas reach the community.' : 'Share what you’re building.'}
        description="Draft a blog, success story, or business listing. Publishing changes only this browser’s demo catalogue."
      />
      <section className="container section">
        <DemoNotice />
        <details
          className="draft-composer"
          open={composerOpen}
          onToggle={(e) => setComposerOpen(e.currentTarget.open)}
        >
          <summary>{editing ? 'Edit local draft' : 'Create a local draft'}</summary>
          <form className="workspace-form" onSubmit={submit}>
            <label>
              Content type
              <select
                disabled={!!editing}
                value={kind}
                onChange={(e) => setKind(e.target.value as Submission['kind'])}
              >
                <option value="story">Success story</option>
                <option value="article">Blog</option>
                {['entrepreneur', 'admin'].includes(account.role) && (
                  <option value="business">Business listing</option>
                )}
              </select>
            </label>
            <label>
              Title
              <input
                required
                minLength={5}
                maxLength={140}
                value={title}
                onChange={(e) => {
                  setSaved(false);
                  setTitle(e.target.value);
                }}
              />
            </label>
            <label>
              Category
              <input
                required
                minLength={2}
                maxLength={60}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <label>
              Content
              <textarea
                required
                minLength={30}
                maxLength={5000}
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <button className="button">
              {editing ? 'Save draft changes' : 'Save local draft'}
            </button>
            {editing && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setEditing(null);
                  setTitle('');
                  setBody('');
                }}
              >
                Cancel editing
              </button>
            )}
            {saved && (
              <p role="status" className="form-success">
                Draft saved below. Submit it for review when ready.
              </p>
            )}
          </form>
        </details>
        <div className="request-list">
          {entries.map((entry) => (
            <article key={entry.id} className="review-card">
              <div>
                <span className="eyebrow">
                  {entry.kind} · {entry.status}
                </span>
                <h2>{entry.title}</h2>
                <p>{entry.body}</p>
                <small>By {state.accounts.find((a) => a.id === entry.ownerId)?.name}</small>
              </div>
              <div className="form-actions">
                {entry.status === 'draft' && (
                  <button
                    className="text-link"
                    onClick={() => {
                      setEditing(entry.id);
                      setTitle(entry.title);
                      setBody(entry.body);
                      setCategory(entry.category);
                      setKind(entry.kind);
                      setSaved(false);
                      setComposerOpen(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Edit draft
                  </button>
                )}
                {entry.status === 'draft' && (
                  <button
                    className="button"
                    onClick={() =>
                      execute({ type: 'submission-status', id: entry.id, status: 'review' })
                    }
                  >
                    Submit for review
                  </button>
                )}
                {entry.status === 'review' && canReview && (
                  <>
                    <button
                      className="button"
                      onClick={() =>
                        execute({ type: 'submission-status', id: entry.id, status: 'published' })
                      }
                    >
                      Publish in demo
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        execute({ type: 'submission-status', id: entry.id, status: 'draft' })
                      }
                    >
                      Return to draft
                    </button>
                  </>
                )}
                {entry.status === 'published' && (
                  <>
                    <Link
                      className="text-link"
                      to={contentPath({ kind: entry.kind, slug: entry.id })}
                    >
                      View published demo →
                    </Link>
                    {canReview && (
                      <button
                        className="text-link"
                        onClick={() =>
                          execute({ type: 'submission-status', id: entry.id, status: 'draft' })
                        }
                      >
                        Unpublish
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        {!entries.length && (
          <p className="empty-state">No local drafts yet. Create your first contribution above.</p>
        )}
      </section>
    </>
  );
}
