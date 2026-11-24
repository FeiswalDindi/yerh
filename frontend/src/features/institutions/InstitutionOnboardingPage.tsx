import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Building2, CheckCircle2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { laravelModeEnabled } from '../../config/laravel';
import { laravelWorkspace } from '../../services/laravel-workspace-repository';
import { errorText } from '../platform/server/WorkspaceActions';

export function InstitutionOnboardingPage() {
  usePageTitle('Partner institution onboarding');

  const [institutionName, setInstitutionName] = useState('');
  const [kind, setKind] = useState<'university' | 'hub' | 'high-school'>('university');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [agreementReference, setAgreementReference] = useState('');
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<{ id: number; name: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('institution_name', institutionName.trim());
      form.append('kind', kind);
      form.append('contact_name', contactName.trim());
      form.append('contact_email', contactEmail.trim());
      form.append('contact_phone', contactPhone.trim());
      if (website.trim()) form.append('website', website.trim());
      if (allowedDomains.trim()) form.append('allowed_domains', allowedDomains.trim());
      if (agreementReference.trim()) form.append('agreement_reference', agreementReference.trim());
      if (agreementFile && agreementFile.size > 0) form.append('agreement', agreementFile);
      if (notes.trim()) form.append('notes', notes.trim());

      const response = await laravelWorkspace.submitInstitutionOnboarding(form);
      setSubmitted({ id: response.data.id, name: institutionName.trim() });
    } catch (failure) {
      setError(errorText(failure));
      triggerCardErrorFeedback(formRef.current);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Institution partnerships"
        title="Onboard your school, university, or hub."
        description="Apply to register your institution on the platform so your students and founders can affiliate, launch ventures, and access incubation pathways."
      />
      <section className="container section contact-grid">
        <div>
          <p className="eyebrow">HOW PARTNER ONBOARDING WORKS</p>
          <h2>Bring structured entrepreneurship to your campus or hub.</h2>
          <p>
            Once approved, your institution appears in the student sign-in selector. Students
            registering with your verified institutional email domain are automatically approved,
            and your focal coordinator unlocks an institution portal to track student ventures and
            progress.
          </p>
          <div className="contact-methods">
            <div>
              <Building2 size={22} />
              <span>
                <small>INSTITUTION TYPES</small>
                Universities, High Schools, and Innovation Hubs
              </span>
            </div>
            <div>
              <FileText size={22} />
              <span>
                <small>VERIFIED STUDENT ACCESS</small>
                Automatic domain verification plus coordinator review fallback
              </span>
            </div>
          </div>
        </div>

        {!laravelModeEnabled ? (
          <div className="contact-form">
            <h2>Online onboarding requires the live server</h2>
            <p className="form-note">
              Institution partnership applications are submitted directly to administrators on the
              live platform, or via our contact page.
            </p>
            <Link className="button" to="/contact?topic=Partnership">
              Contact partnership team <ArrowRight size={17} />
            </Link>
          </div>
        ) : submitted ? (
          <div className="contact-form" role="status">
            <div className="form-success">
              <strong>
                <CheckCircle2 size={18} aria-hidden="true" /> Onboarding application received
              </strong>
              <p>
                Thank you. Your application for <strong>{submitted.name}</strong> (reference #
                {submitted.id}) has been sent to our administrators for review. We will email{' '}
                <strong>{contactEmail}</strong> once your institution is provisioned.
              </p>
            </div>
            <Link className="button" to="/">
              Return home <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <form
            ref={formRef}
            className="contact-form"
            onSubmit={(e) => void handleSubmit(e)}
            onInvalidCapture={() => triggerCardErrorFeedback(formRef.current)}
          >
            <h2>Institution details</h2>
            <div className="form-row">
              <label>
                Institution name
                <input
                  name="institution_name"
                  required
                  minLength={2}
                  maxLength={160}
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Strathmore University"
                />
              </label>
              <label>
                Institution type
                <select
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as 'university' | 'hub' | 'high-school')}
                >
                  <option value="university">University</option>
                  <option value="hub">Innovation Hub</option>
                  <option value="high-school">High School</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                Focal coordinator name
                <input
                  name="contact_name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </label>
              <label>
                Official coordinator email
                <input
                  name="contact_email"
                  type="email"
                  required
                  maxLength={254}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="coordinator@university.ac.ke"
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Contact phone
                <input
                  name="contact_phone"
                  required
                  minLength={6}
                  maxLength={40}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+254700000000"
                />
              </label>
              <label>
                Institution website (optional)
                <input
                  name="website"
                  type="url"
                  maxLength={300}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>

            <label>
              Verified student email domains (optional, comma-separated)
              <input
                name="allowed_domains"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="e.g. students.example.ac.ke, example.ac.ke"
              />
            </label>

            <div className="form-row">
              <label>
                Agreement / MOU reference (optional)
                <input
                  name="agreement_reference"
                  maxLength={180}
                  value={agreementReference}
                  onChange={(e) => setAgreementReference(e.target.value)}
                />
              </label>
              <label>
                Agreement / authorization letter PDF (optional, max 5 MB)
                <input
                  name="agreement"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setAgreementFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <label>
              Additional notes (optional)
              <textarea
                name="notes"
                rows={4}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share expected student cohort size or coordinator details..."
              />
            </label>

            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}

            <button className="button" type="submit" disabled={busy}>
              {busy ? 'Submitting application…' : 'Submit onboarding application'}
              <ArrowRight size={17} />
            </button>
          </form>
        )}
      </section>
    </>
  );
}
