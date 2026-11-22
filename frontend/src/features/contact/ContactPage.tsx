import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { emailDraftHref, type ContactDraft } from './contact';
export function ContactPage() {
  const { site } = useCatalog();
  const [params] = useSearchParams();
  const topics = [
    'General enquiry',
    'Mentorship',
    'Learning resources',
    'Partnership',
    'Share my story',
  ];
  const [draft, setDraft] = useState<ContactDraft>({
    name: '',
    email: '',
    topic: topics.includes(params.get('topic') || '') ? params.get('topic')! : topics[0]!,
    message: '',
  });
  const [prepared, setPrepared] = useState(false);
  usePageTitle('Contact the team');
  function update(field: keyof ContactDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setPrepared(false);
  }
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPrepared(true);
  }
  return (
    <>
      <PageIntro
        eyebrow="Contact us"
        title="Good conversations open new doors."
        description="Have a question, an idea, or a story to share? We’d love to hear from you."
      />
      <section className="container section contact-grid">
        <div>
          <p className="eyebrow">LET’S CONNECT</p>
          <h2>Start a conversation.</h2>
          <p>
            Reach out about the hub, explore a partnership, or find out how to contribute to the
            community.
          </p>
          <div className="contact-methods">
            <a href={`mailto:${site.contact.email}`}>
              <Mail size={22} />
              <span>
                <small>EMAIL US</small>
                {site.contact.email}
              </span>
              <ArrowUpRight size={17} />
            </a>
            <a href={`tel:${site.contact.phone}`}>
              <Phone size={22} />
              <span>
                <small>CALL US</small>
                {site.contact.phone}
              </span>
              <ArrowUpRight size={17} />
            </a>
            <div>
              <MapPin size={22} />
              <span>
                <small>FIND US</small>
                {site.contact.address}
              </span>
            </div>
          </div>
        </div>
        <form className="contact-form" onSubmit={prepare}>
          <h2>What’s on your mind?</h2>
          <div className="form-row">
            <label>
              Your name
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={draft.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </label>
          </div>
          <label>
            I’d like to talk about
            <select
              name="topic"
              value={draft.topic}
              onChange={(e) => update('topic', e.target.value)}
            >
              {topics.map((topic) => (
                <option key={topic}>{topic}</option>
              ))}
            </select>
          </label>
          <label>
            Your message
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={2000}
              rows={6}
              value={draft.message}
              onChange={(e) => update('message', e.target.value)}
              placeholder="Tell us a little about how we can help…"
            />
          </label>
          <p className="form-note">
            Prepare a draft to open in your email app. Nothing is sent or stored by this site.
          </p>
          <button className="button" type="submit">
            Prepare email
            <ArrowUpRight size={17} />
          </button>
          {prepared && (
            <div className="form-success" role="status">
              <strong>Your email draft is ready.</strong>
              <p>Open your email app to review and send it.</p>
              <a className="text-link" href={emailDraftHref(site.contact.email, draft)}>
                Open email draft
                <ArrowUpRight size={16} />
              </a>
            </div>
          )}
        </form>
      </section>
    </>
  );
}
