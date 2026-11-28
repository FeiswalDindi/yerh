import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  CheckCircle2,
  GraduationCap,
  Handshake,
  LineChart,
  School,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { useLaravelSession } from '../../app/useLaravelSession';
import { laravelModeEnabled } from '../../config/laravel';
import { laravelWorkspace } from '../../services/laravel-workspace-repository';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { InstitutionOnboardingForm } from '../institutions/InstitutionOnboardingPage';
import { errorText } from '../platform/server/WorkspaceActions';
import {
  getDefaultManagedPage,
  lookupManagedPage,
} from '../platform/server/cms/cms-page-registry';
import './careers.css';

type CareerPathId = 'institutions' | 'partnerships' | 'mentorship' | 'investor';

const TRACK_TABS = [
  { href: '/careers', label: 'All Pathways' },
  { href: '/careers/institutions', label: 'Register Institution' },
  { href: '/careers/partnerships', label: 'Partnerships' },
  { href: '/careers/mentorship', label: 'Mentorship' },
  { href: '/careers/invest', label: 'Invest with Us' },
];

const OVERVIEW_PILLARS: {
  id: CareerPathId;
  href: string;
  badge: string;
  title: string;
  summary: string;
  highlights: string[];
  cta: string;
  icon: typeof Building2;
}[] = [
  {
    id: 'institutions',
    href: '/careers/institutions',
    badge: 'Schools · Universities · Hubs',
    title: 'Register Your Institution',
    summary:
      'Equip learners and incubated founders with verified access, venture pathways, cohort analytics, and Moodle integration.',
    highlights: [
      'Automatic domain verification or coordinator approval',
      'High school teaching guides, marks & certificates',
      'Dedicated institutional portal & administrator oversight',
    ],
    cta: 'Onboard an institution',
    icon: Building2,
  },
  {
    id: 'partnerships',
    href: '/careers/partnerships',
    badge: 'Organisations & Ecosystem Partners',
    title: 'Partnerships',
    summary:
      'Co-host entrepreneurship clinics and bootcamps, propose training themes, and connect with youth ventures nationwide.',
    highlights: [
      'Partner Dashboard to organize & submit events',
      'Track registrations and manage speakers/hosts',
      'Homepage & event catalogue organizational visibility',
    ],
    cta: 'Apply for partnership',
    icon: Handshake,
  },
  {
    id: 'mentorship',
    href: '/careers/mentorship',
    badge: 'Founders & Industry Practitioners',
    title: 'Mentorship',
    summary:
      'Coach emerging entrepreneurs across structured incubation stages, share feedback in Moodle, and grow sector capacity.',
    highlights: [
      'Multi-institution venture coaching dashboard',
      'Grade stage milestones & guide product readiness',
      'Propose paid Moodle courses and earn royalties',
    ],
    cta: 'Apply as a mentor',
    icon: Award,
  },
  {
    id: 'investor',
    href: '/careers/invest',
    badge: 'Capital · Grants · Angels',
    title: 'Invest with Us',
    summary:
      'Back incubation-ready youth enterprises that have proven execution, compliance readiness, and customer traction.',
    highlights: [
      'Structured diligence across vetted youth ventures',
      'Launch targeted funding challenges or fellowships',
      'Transparent milestone tracking overseen by YERH',
    ],
    cta: 'Submit investor inquiry',
    icon: LineChart,
  },
];

function CareerSectionsGrid({
  pathname,
  heading,
  eyebrow,
}: {
  pathname: string;
  heading: string;
  eyebrow: string;
}) {
  const { site } = useCatalog();
  const cmsPage = lookupManagedPage(site.pages, pathname);
  const fallbackPage = getDefaultManagedPage(pathname);
  const sections =
    cmsPage && cmsPage.sections.length > 0
      ? cmsPage.sections
      : (fallbackPage?.sections ?? []);

  if (!sections.length) return null;

  return (
    <section className="careers-advantages" aria-label={heading}>
      <div className="careers-section-head">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{heading}</h2>
      </div>
      <div className="careers-advantages-grid">
        {sections.map((sec, idx) => (
          <article className="profile-panel careers-advantage-card" key={`${idx}-${sec.title}`}>
            <span className="careers-advantage-num">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <h3>{sec.title}</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{sec.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CareerApplicationForm({
  track,
  heading,
  lead,
  orgLabel,
  orgPlaceholder,
  focusLabel,
  focusPlaceholder,
  messagePlaceholder,
}: {
  track: 'partnership' | 'mentorship' | 'investor';
  heading: string;
  lead: string;
  orgLabel: string;
  orgPlaceholder: string;
  focusLabel: string;
  focusPlaceholder: string;
  messagePlaceholder: string;
}) {
  const session = useLaravelSession();
  const profile = session?.profile;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!profile) return;
    setName((cur) => cur || profile.name || '');
    setEmail((cur) => cur || profile.email || '');
  }, [profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await laravelWorkspace.submitCareerApplication({
        track,
        applicant_name: name.trim(),
        applicant_email: email.trim(),
        applicant_phone: phone.trim(),
        organization: organization.trim() || undefined,
        website: website.trim() || undefined,
        linkedin_url: linkedin.trim() || undefined,
        focus_area: focusArea.trim() || undefined,
        message: message.trim(),
      });
      setSubmittedId(res.data.id);
    } catch (cause) {
      setError(errorText(cause));
      triggerCardErrorFeedback(formRef.current);
    } finally {
      setBusy(false);
    }
  }

  if (!laravelModeEnabled) {
    return (
      <div className="contact-form">
        <h2>{heading}</h2>
        <p className="form-note">
          Requests submitted on the live server go straight to YERH platform administrators. You can
          also reach us via our contact desk.
        </p>
        <Link className="button" to="/contact">
          Open contact page <ArrowRight size={17} />
        </Link>
      </div>
    );
  }

  if (submittedId !== null) {
    return (
      <div className="contact-form" role="status">
        <div className="form-success">
          <strong>
            <CheckCircle2 size={18} aria-hidden="true" /> Request submitted (#{submittedId})
          </strong>
          <p>
            Thank you, <strong>{name}</strong>. Your request has been sent to YERH platform
            administrators for review. We will notify <strong>{email}</strong> as soon as an
            administrator completes review.
          </p>
        </div>
        <div className="workspace-row-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              setSubmittedId(null);
              setMessage('');
            }}
          >
            Submit another request
          </button>
          <Link className="button" to="/careers">
            Explore other pathways <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="contact-form"
      onSubmit={(e) => void handleSubmit(e)}
      onInvalidCapture={() => triggerCardErrorFeedback(formRef.current)}
    >
      <h2>{heading}</h2>
      <p className="careers-form-lead">{lead}</p>
      <div className="form-row">
        <label>
          Full name
          <input
            name="applicant_name"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amina Wanjiku"
          />
        </label>
        <label>
          Email address
          <input
            name="applicant_email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@organization.org"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Phone / WhatsApp number
          <input
            name="applicant_phone"
            required
            minLength={6}
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254700000000"
          />
        </label>
        <label>
          {orgLabel}
          <input
            name="organization"
            maxLength={160}
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder={orgPlaceholder}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          {focusLabel}
          <input
            name="focus_area"
            maxLength={140}
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder={focusPlaceholder}
          />
        </label>
        <label>
          Website (optional)
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
        LinkedIn or profile URL (optional)
        <input
          name="linkedin_url"
          type="url"
          maxLength={300}
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="https://www.linkedin.com/in/..."
        />
      </label>

      <label>
        How would you like to collaborate?
        <textarea
          name="message"
          required
          minLength={15}
          maxLength={3000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messagePlaceholder}
        />
      </label>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <button className="button" type="submit" disabled={busy}>
        {busy ? 'Sending request…' : 'Send request to Admin'}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}

function CareersTabs({ activePath }: { activePath: string }) {
  return (
    <nav className="section-tabs careers-nav-tabs" aria-label="Career and collaboration pathways">
      {TRACK_TABS.map((tab) => (
        <Link
          key={tab.href}
          to={tab.href}
          aria-current={activePath === tab.href ? 'page' : undefined}
          className={activePath === tab.href ? 'is-active' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function CareersPage() {
  const { pathname } = useLocation();
  const normalized = pathname.replace(/\/+$/, '') || '/careers';

  const pageTitles: Record<string, string> = {
    '/careers': 'Careers & Collaboration',
    '/careers/institutions': 'Register Your Institution · Careers',
    '/careers/partnerships': 'Partnerships · Careers',
    '/careers/mentorship': 'Mentorship · Careers',
    '/careers/invest': 'Invest with Us · Careers',
  };
  usePageTitle(pageTitles[normalized] ?? 'Careers');

  if (normalized === '/careers/institutions') {
    return (
      <>
        <PageIntro
          eyebrow="Careers · Register Your Institution"
          title="Onboard your high school, university, or innovation hub."
          description="Bring structured entrepreneurship learning, verified student affiliation, cohort tracking, and Moodle classroom integration to your campus or hub."
        />
        <section className="container section">
          <CareersTabs activePath="/careers/institutions" />

          <div className="careers-institution-types" aria-label="Supported institution types">
            <article className="profile-panel careers-type-card">
              <School size={24} aria-hidden="true" />
              <h2>High Schools</h2>
              <p>
                Structured class venture teams, cohort marks &amp; milestones, Moodle Teaching &amp;
                Grading Guide, and verified learner certificates.
              </p>
            </article>
            <article className="profile-panel careers-type-card">
              <GraduationCap size={24} aria-hidden="true" />
              <h2>Universities &amp; Colleges</h2>
              <p>
                Auto-approved student sign-in via verified campus email domains, coordinator
                approvals, and campus entrepreneurship portals.
              </p>
            </article>
            <article className="profile-panel careers-type-card">
              <Sparkles size={24} aria-hidden="true" />
              <h2>Innovation Hubs</h2>
              <p>
                Co-manage founder cohorts, link external YERH mentors, track venture product
                listings, and review progression evidence.
              </p>
            </article>
          </div>

          <CareerSectionsGrid
            pathname="/careers/institutions"
            eyebrow="INSTITUTION ADVANTAGES & ROLES"
            heading="How onboarding works for your institution"
          />

          <div className="contact-grid careers-application-split">
            <div className="profile-panel careers-side-note">
              <p className="eyebrow">DIRECT ADMIN REVIEW</p>
              <h2>Ready to register your institution?</h2>
              <p>
                Submit your institution details and optional MOU/authorization letter. Once an
                administrator approves your application, your institution appears in sign-in and
                affiliation workflows automatically, and your focal coordinator unlocks the portal.
              </p>
              <ul className="careers-checklist">
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Fast activation in institutional
                  selectors
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Verified email domain auto-approval
                  support
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Dedicated high school, university, or
                  hub workflows
                </li>
              </ul>
            </div>

            <InstitutionOnboardingForm />
          </div>
        </section>
      </>
    );
  }

  if (normalized === '/careers/partnerships') {
    return (
      <>
        <PageIntro
          eyebrow="Careers · Partnerships"
          title="Partner with YERH to accelerate young founders."
          description="Co-host transformative events, sponsor ecosystem programmes, propose training themes, and connect directly with emerging youth-led enterprises."
        />
        <section className="container section">
          <CareersTabs activePath="/careers/partnerships" />
          <CareerSectionsGrid
            pathname="/careers/partnerships"
            eyebrow="PARTNERSHIP ADVANTAGES & ROLES"
            heading="What approved partners unlock on YERH"
          />
          <div className="contact-grid careers-application-split">
            <div className="profile-panel careers-side-note">
              <p className="eyebrow">PARTNER WORKFLOW</p>
              <h2>Built for ecosystem impact.</h2>
              <p>
                Your partnership proposal goes directly to YERH platform administrators for review.
                If you already have a verified YERH account using the same email address, Admin can
                immediately unlock your Partner Dashboard upon approval.
              </p>
              <ul className="careers-checklist">
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Organize and submit virtual or
                  physical events
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Access live attendee rosters and
                  export insights
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Propose curated course themes for
                  Admin publishing
                </li>
              </ul>
            </div>
            <CareerApplicationForm
              track="partnership"
              heading="Submit a partnership request"
              lead="Share your organization’s mission and how you would like to collaborate with YERH."
              orgLabel="Organization / company"
              orgPlaceholder="e.g. Rift Valley Enterprise Foundation"
              focusLabel="Partnership focus"
              focusPlaceholder="e.g. Events, Bootcamps, Sponsorship, Market Access"
              messagePlaceholder="Describe the programmes, events, or support you want to co-deliver with YERH..."
            />
          </div>
        </section>
      </>
    );
  }

  if (normalized === '/careers/mentorship') {
    return (
      <>
        <PageIntro
          eyebrow="Careers · Mentorship"
          title="Guide the next generation of Kenyan founders."
          description="Share your operational wisdom, coach incubated ventures through structured stages, and build measurable entrepreneurial capability."
        />
        <section className="container section">
          <CareersTabs activePath="/careers/mentorship" />
          <CareerSectionsGrid
            pathname="/careers/mentorship"
            eyebrow="MENTOR ADVANTAGES & ROLES"
            heading="Why experienced builders mentor on YERH"
          />
          <div className="contact-grid careers-application-split">
            <div className="profile-panel careers-side-note">
              <p className="eyebrow">MENTOR WORKFLOW</p>
              <h2>Flexible, high-trust coaching.</h2>
              <p>
                Requests are reviewed by YERH platform administrators. Once approved, you gain the
                Mentor role inside your dashboard and unified access to assigned student ventures
                across partner institutions and Moodle.
              </p>
              <ul className="careers-checklist">
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Single login for ventures across
                  multiple institutions
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Structured stage assessment and
                  evidence reviews
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Optional course authoring proposals
                  with royalties
                </li>
              </ul>
            </div>
            <CareerApplicationForm
              track="mentorship"
              heading="Apply to become a YERH Mentor"
              lead="Tell us about your entrepreneurial or industry background and where you can guide young founders."
              orgLabel="Company / venture affiliation (optional)"
              orgPlaceholder="e.g. Savanna Foods Ltd"
              focusLabel="Areas of expertise"
              focusPlaceholder="e.g. Agribusiness, Finance, Go-to-Market, SaaS"
              messagePlaceholder="Share your experience, ventures you have built or advised, and your availability..."
            />
          </div>
        </section>
      </>
    );
  }

  if (normalized === '/careers/invest') {
    return (
      <>
        <PageIntro
          eyebrow="Careers · Invest with Us"
          title="Back vetted, incubation-ready youth enterprises."
          description="Partner with YERH to discover high-potential ventures completing structured milestones, market testing, and compliance readiness."
        />
        <section className="container section">
          <CareersTabs activePath="/careers/invest" />
          <CareerSectionsGrid
            pathname="/careers/invest"
            eyebrow="INVESTOR ADVANTAGES & ROLES"
            heading="Invest with confidence across verified pipelines"
          />
          <div className="contact-grid careers-application-split">
            <div className="profile-panel careers-side-note">
              <p className="eyebrow">INVESTMENT & FUNDING DESK</p>
              <h2>Connect directly with our administration team.</h2>
              <p>
                Whether you represent an angel syndicate, impact fund, philanthropic grant, or
                corporate innovation vehicle, your inquiry goes straight to platform administrators
                for dedicated follow-up.
              </p>
              <ul className="careers-checklist">
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Milestone-verified venture
                  pipelines
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Transparent institution &amp; cohort
                  provenance
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" /> Co-branded opportunity &amp;
                  challenge launches
                </li>
              </ul>
            </div>
            <CareerApplicationForm
              track="investor"
              heading="Submit an investment or funding inquiry"
              lead="Share your investment thesis, stage focus, or grant objectives with our admin team."
              orgLabel="Fund / syndicate / organization"
              orgPlaceholder="e.g. East Africa Youth Seed Fund"
              focusLabel="Investment / funding thesis"
              focusPlaceholder="e.g. Pre-seed equity, Climate & Agri grants, Revenue-based"
              messagePlaceholder="Share ticket sizes, sectors of interest, and how you would like to engage with YERH ventures..."
            />
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageIntro
        eyebrow="Careers & Collaboration"
        title="Build the future of youth enterprise with us."
        description="Whether you represent an institution, partner organization, experienced mentor, or impact investor, discover how you can shape young entrepreneurs across Kenya."
      />
      <section className="container section">
        <CareersTabs activePath="/careers" />

        <div className="careers-pillars-grid">
          {OVERVIEW_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article className="profile-panel careers-pillar-card" key={pillar.id}>
                <div className="careers-pillar-top">
                  <span className="careers-pillar-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="users-badge">{pillar.badge}</span>
                </div>
                <h2>{pillar.title}</h2>
                <p>{pillar.summary}</p>
                <ul className="careers-checklist">
                  {pillar.highlights.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={15} aria-hidden="true" /> {item}
                    </li>
                  ))}
                </ul>
                <Link className="button" to={pillar.href}>
                  {pillar.cta} <ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>

        <CareerSectionsGrid
          pathname="/careers"
          eyebrow="HOW COLLABORATION WORKS"
          heading="Transparent roles, real ecosystem impact"
        />

        <div className="profile-panel careers-overview-banner">
          <div>
            <p className="eyebrow">
              <Briefcase size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> DIRECT
              ADMIN REVIEW
            </p>
            <h2>Every request goes directly to YERH Administrators</h2>
            <p>
              All institutional onboardings, partnership proposals, mentor applications, and
              investor inquiries are reviewed inside the Admin Approval Queue so nothing gets lost.
            </p>
          </div>
          <Link className="button button-gold" to="/careers/partnerships">
            <TrendingUp size={16} aria-hidden="true" /> Start a conversation
          </Link>
        </div>
      </section>
    </>
  );
}
