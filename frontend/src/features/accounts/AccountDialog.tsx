import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert, FlaskConical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { platformHref } from '../../config/site';
import { CloseButton } from '../../shared/CloseButton';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
import { SmartImage } from '../../shared/SmartImage';
import { INLINE_YERH_LOGO } from '../../config/brand-inline';
import { TermsDialog } from '../legal/TermsDialog';
import { GoogleAccountButton } from './GoogleAccountButton';
import { accountDestination, type AccountRequest } from './account-navigation';
import { institutionAccess } from '../../domain/incubation';
import { institutionSignInProblem } from '../../domain/institution-members';
import type { DemoAccount } from '../../domain/demo';
import { institutionHref } from '../dashboard/dashboard-navigation';
import { LaravelAccountForm } from './LaravelAccountForm';
import { laravelModeEnabled } from '../../config/laravel';
import { useLaravelSession } from '../../app/useLaravelSession';
import {
  localLaravelIdentity,
  type InstitutionChoice,
} from '../../services/laravel-identity-repository';
import './account.css';

export function AccountDialog({ mode, search, onClose }: AccountRequest & { onClose: () => void }) {
  const { state } = useDemo();
  const useLaravel = laravelModeEnabled;
  const [register, setRegister] = useState(mode === 'register');
  const [selecting, setSelecting] = useState(!useLaravel && mode !== 'register');
  const [liveInstitutions, setLiveInstitutions] = useState<InstitutionChoice[]>([]);
  const [institutionError, setInstitutionError] = useState('');
  const session = useLaravelSession();
  useEffect(() => {
    if (!laravelModeEnabled || !selecting || session?.profile) return;
    const request = new AbortController();
    void localLaravelIdentity
      .choices(request.signal)
      .then((rows) => {
        if (!request.signal.aborted) setLiveInstitutions(rows);
      })
      .catch((error: unknown) => {
        if (!request.signal.aborted) {
          setInstitutionError(
            error instanceof Error ? error.message : 'Could not load institutions.',
          );
          signalError();
        }
      });
    return () => request.abort();
  }, [selecting, session?.profile]);
  const institutions = useLaravel
    ? []
    : state.platform.training.institutions.filter((school) => school.status === 'active');
  const yerh = useLaravel || state.platform.training.yerhSignIn !== false;
  const [institution, setInstitution] = useState(() => {
    const requested = new URLSearchParams(search).get('institution');
    if (requested) {
      if (requested === 'yerh') return 'yerh';
      const match = institutions.find((school) => school.id === requested);
      if (match) return match.id;
      if (useLaravel) return requested;
    }
    if (useLaravel) return '';
    return yerh ? 'yerh' : '';
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const institutionCard = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const startedOutside = useRef(false);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);

  function close() {
    dialog.current?.close();
    onClose();
  }

  const showingInstitution = selecting && (!useLaravel || !session?.profile);

  function signalError() {
    triggerCardErrorFeedback(showingInstitution ? institutionCard.current : card.current);
  }
  const title = register ? 'Create your account' : 'Sign in';
  const selectedInstitutionName =
    institution === 'yerh'
      ? 'No Institution'
      : ((useLaravel
          ? liveInstitutions.find((row) => row.slug === institution)?.name
          : institutions.find((school) => school.id === institution)?.name) ?? institution);
  return (
    <dialog
      ref={dialog}
      className={
        showingInstitution ? 'account-dialog account-institution-dialog' : 'account-dialog'
      }
      aria-labelledby="account-title"
      aria-describedby={showingInstitution ? undefined : 'account-description'}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        close();
      }}
      onPointerDown={(event) => {
        startedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (startedOutside.current && event.target === event.currentTarget) close();
      }}
    >
      <CloseButton
        ref={closeButton}
        className="icon-button account-close"
        aria-label="Close account dialog"
        onClick={close}
      />
      {showingInstitution ? (
        <div className="account-institution-card" ref={institutionCard}>
          <SmartImage
            className="account-institution-image"
            src="/media/institution-sign-in.webp"
            alt=""
            priority
            targetWidth={840}
          />
          <form
            className="account-institution-form"
            onInvalidCapture={signalError}
            onSubmit={(event) => {
              event.preventDefault();
              if (!institution) {
                signalError();
                return;
              }
              setSelecting(false);
              closeButton.current?.focus();
            }}
          >
            <img src={INLINE_YERH_LOGO} width={108} height={108} decoding="sync" alt="YERH" />
            <h2 id="account-title">Select your institution</h2>
            <label className="account-field">
              <span className="sr-only">Institution</span>
              <select
                required
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
              >
                <option value="" disabled>
                  Choose an institution
                </option>
                {(useLaravel || yerh) && (
                  <option value="yerh">No Institution</option>
                )}
                {(useLaravel
                  ? liveInstitutions.map((row) => ({ id: row.slug, name: row.name }))
                  : institutions
                ).map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
            {institutionError && (
              <p role="alert" className="account-error">
                {institutionError}
              </p>
            )}
            <button className="button account-submit">
              Continue <ArrowRight size={18} aria-hidden="true" />
            </button>
            <p className="account-switch">
              School, university, or hub administrator?{' '}
              <Link className="account-link" to="/institutions/apply" onClick={close}>
                Register your institution
              </Link>
            </p>
          </form>
        </div>
      ) : (
        <div className="account-card" ref={card}>
          <Link className="account-brand" to="/" aria-label="YERH home" onClick={close}>
            <img
              src={INLINE_YERH_LOGO}
              width={104}
              height={104}
              decoding="sync"
              alt=""
              fetchPriority="high"
            />
          </Link>
          {useLaravel ? (
            <LaravelAccountForm
              key={String(register)}
              title={title}
              register={register}
              institution={institution}
              institutionLabel={selectedInstitutionName}
              search={search}
              verification={new URLSearchParams(search).get('verification')}
              onComplete={close}
              onClearInstitution={() => setInstitution('')}
              onErrorFeedback={signalError}
              onSwitch={() => {
                setRegister(!register);
                setSelecting(false);
              }}
            />
          ) : (
            <AccountForm
              key={String(register)}
              title={title}
              register={register}
              institution={institution}
              onChangeInstitution={register ? undefined : () => setSelecting(true)}
              search={search}
              onGoogleUnavailable={signalError}
              onErrorFeedback={signalError}
              onSwitch={() => {
                closeButton.current?.focus();
                setRegister(!register);
                setSelecting(register);
              }}
            />
          )}
        </div>
      )}
    </dialog>
  );
}

function AccountForm({
  title,
  register,
  institution,
  search,
  onSwitch,
  onGoogleUnavailable,
  onErrorFeedback,
  onChangeInstitution,
}: {
  title: string;
  register: boolean;
  institution: string;
  search: string;
  onSwitch: () => void;
  onGoogleUnavailable: () => void;
  onErrorFeedback: () => void;
  onChangeInstitution?: () => void;
}) {
  const { account, state, enabled, execute, error } = useDemo();
  const navigate = useNavigate();
  const [termsOpen, setTermsOpen] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const host = platformHref(register ? '/register' : '/login');
  const institutions = state.platform.training.institutions.filter(
    (school) => school.status === 'active',
  );
  const selectedSchool = institutions.find((school) => school.id === institution);
  const message = actionFailed ? error : '';
  const wrongInstitution =
    account && !register ? institutionSignInProblem(state.platform, account, institution) : null;

  function destination(member: DemoAccount) {
    const access = selectedSchool && institutionAccess(selectedSchool, member);
    const fallback =
      selectedSchool && access
        ? institutionHref(
            selectedSchool.kind === 'high-school' && access === 'view'
              ? 'member-results'
              : 'school',
            selectedSchool.id,
          )
        : member.role === 'guest'
          ? '/account'
          : '/dashboard';
    return accountDestination(search, fallback);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || account) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();

    if (register) {
      const created = execute({
        type: 'signup',
        id: `member-${crypto.randomUUID()}`,
        name: String(form.get('name') ?? ''),
        location: String(form.get('location') ?? ''),
        email,
        phone: '',
        ageRange: '',
        consent: form.get('terms') === 'on',
        institutionId: String(form.get('institution') ?? '') || undefined,
        now: new Date().toISOString(),
      });
      setActionFailed(!created);
      if (!created) onErrorFeedback();
      if (created) navigate(accountDestination(search, '/account'), { replace: true });
      return;
    }

    const signedIn = execute({ type: 'email-sign-in', email, institutionId: institution });
    setActionFailed(!signedIn);
    if (!signedIn) onErrorFeedback();
    if (signedIn) {
      const member = state.accounts.find((person) => person.email.toLowerCase() === email);
      if (member) navigate(destination(member), { replace: true });
    }
  }

  function signOut() {
    const ok = execute({ type: 'logout' });
    setActionFailed(!ok);
    if (!ok) onErrorFeedback();
  }

  return (
    <>
      <header className="account-heading">
        <h2 id="account-title">{title}</h2>
        <p id="account-description">
          {register ? 'Youth Entrepreneurship Resource Hub.' : 'Access your workspace.'}
        </p>
        {onChangeInstitution && (
          <button type="button" className="account-link" onClick={onChangeInstitution}>
            {institutions.find((school) => school.id === institution)?.name ?? 'YERH'} · Change
            institution
          </button>
        )}
        {enabled && (
          <aside className="account-preview" aria-label="Development preview">
            <FlaskConical size={16} aria-hidden="true" />
            <span>Use a test email.</span>
            <Link className="account-link" to={`/demo${search}`}>
              Demo accounts
            </Link>
            {host && (
              <a className="account-link" href={host}>
                Open live account portal
              </a>
            )}
          </aside>
        )}
      </header>

      {enabled && account ? (
        <div className="account-form">
          {account.suspended ? (
            <p>This account is suspended.</p>
          ) : wrongInstitution ? (
            <p className="account-error" role="alert">
              {wrongInstitution}
            </p>
          ) : (
            <>
              <p>
                You’re signed in as <strong>{account.name}</strong>.
              </p>
              <Link className="button account-submit" to={destination(account)}>
                Continue <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </>
          )}
          <button className="account-link" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : enabled ? (
        <form className="account-form" onSubmit={submit} onInvalidCapture={onErrorFeedback}>
          {register && (
            <label className="account-field">
              Full name
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
              />
            </label>
          )}
          <label className="account-field">
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              maxLength={254}
              spellCheck={false}
            />
          </label>
          {register && (
            <>
              <label className="account-field">
                City or county
                <input
                  name="location"
                  type="text"
                  autoComplete="address-level2"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label className="account-field">
                Preferred institution (optional)
                <select name="institution" defaultValue="">
                  <option value="">No institution selected</option>
                  {state.platform.training.yerhSignIn !== false && (
                    <option value="yerh">YERH</option>
                  )}
                  {institutions
                    .filter((school) => school.kind !== 'high-school')
                    .map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="account-agreement">
                <label className="account-checkbox">
                  <input type="checkbox" name="terms" required />
                  <span>I accept the terms and privacy notice.</span>
                </label>
                <div className="account-legal-links">
                  <button className="account-link" type="button" onClick={() => setTermsOpen(true)}>
                    Terms of use
                  </button>
                  <Link className="account-link" to="/privacy">
                    Privacy notice
                  </Link>
                </div>
              </div>
            </>
          )}
          {message && (
            <p className="account-error" role="alert">
              <CircleAlert size={17} aria-hidden="true" />
              {message}
            </p>
          )}
          <button className="button account-submit" type="submit">
            {register ? 'Create account' : 'Sign in'} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <div className="account-form">
          {host ? (
            <a href={host} className="button account-submit">
              {register ? 'Continue to registration' : 'Continue to sign in'}{' '}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          ) : (
            <>
              <p className="account-status">
                {register ? 'Online registration' : 'Member sign-in'} is currently unavailable.
              </p>
              <Link className="button account-submit" to="/resources">
                Explore resources <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      )}

      {!account && (
        <>
          <GoogleAccountButton onUnavailable={onGoogleUnavailable} />
          <p className="account-switch">
            {register ? 'Already have an account?' : 'New to YERH?'}{' '}
            <button className="account-link" type="button" onClick={onSwitch}>
              {register ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </>
      )}
      {account && message && (
        <p className="account-error" role="alert">
          {message}
        </p>
      )}
      {termsOpen && <TermsDialog onClose={() => setTermsOpen(false)} />}
    </>
  );
}
