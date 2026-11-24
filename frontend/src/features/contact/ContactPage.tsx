import { useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Building2, CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { laravelModeEnabled } from '../../config/laravel';
import { laravelWorkspace } from '../../services/laravel-workspace-repository';
import { errorText } from '../platform/server/WorkspaceActions';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
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
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [sentId, setSentId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  usePageTitle('Contact the team');
  function update(field: keyof ContactDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setPrepared(false);
    setSubmitError('');
    setSentId(null);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!laravelModeEnabled) {
      setPrepared(true);
      return;
    }
    setBusy(true);
    setSubmitError('');
    try {
      const response = await laravelWorkspace.submitContactMessage(draft);
      setSentId(response.data.id);
      setDraft({ name: '', email: '', topic: draft.topic, message: '' });
    } catch (failure) {
      setSubmitError(errorText(failure));
      triggerCardErrorFeedback(formRef.current);
    } finally {
      setBusy(false);
    }
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
            <Link to="/institutions/apply">
              <Building2 size={22} />
              <span>
                <small>PARTNER WITH US</small>
                Apply to onboard a school, university, or hub
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <div>
              <MapPin size={22} />
              <span>
                <small>FIND US</small>
                {site.contact.address}
              </span>
            </div>
          </div>
        </div>
        <form
          ref={formRef}
          className="contact-form"
          onSubmit={(e) => void handleSubmit(e)}
          onInvalidCapture={() => triggerCardErrorFeedback(formRef.current)}
        >
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
          {laravelModeEnabled ? (
            <>
              <p className="form-note">
                Your enquiry goes straight to our workspace team inbox and a coordinator will reply
                by email.
              </p>
              {submitError && (
                <p role="alert" className="form-error">
                  {submitError}
                </p>
              )}
              <button className="button" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send message'}
                <ArrowUpRight size={17} />
              </button>
              {sentId !== null && (
                <div className="form-success" role="status">
                  <strong>
                    <CheckCircle2 size={16} aria-hidden="true" /> Thank you — your message has been
                    received.
                  </strong>
                  <p>Reference #{sentId}. Our team will follow up with you shortly.</p>
                </div>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </form>
      </section>
    </>
  );
}
