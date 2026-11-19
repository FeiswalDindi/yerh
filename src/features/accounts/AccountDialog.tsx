import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert, FlaskConical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { platformHref } from '../../config/site';
import { CloseButton } from '../../shared/CloseButton';
import { TermsDialog } from '../legal/TermsDialog';
import { GoogleAccountButton } from './GoogleAccountButton';
import { accountDestination, type AccountRequest } from './account-navigation';
import { institutionAccess } from '../../domain/incubation';
import { institutionHref } from '../dashboard/dashboard-navigation';
import './account.css';

export function AccountDialog({ mode, search, onClose }: AccountRequest & { onClose: () => void }) {
  const { media } = useCatalog();
  const { state } = useDemo();
  const [register, setRegister] = useState(mode === 'register');
  const [selecting, setSelecting] = useState(mode !== 'register');
  const [institution, setInstitution] = useState('');
  const institutions = state.platform.training.institutions.filter(
    (school) => school.status === 'active',
  );
  const yerh = state.platform.training.yerhSignIn !== false;
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const shake = useRef<Animation>(null);
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

  function signalUnavailable() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    shake.current?.cancel();
    shake.current =
      card.current?.animate?.(
        [0, -5, 5, -4, 4, -2, 2, 0].map((offset) => ({ transform: `translateX(${offset}px)` })),
        { duration: 300, easing: 'ease-out' },
      ) ?? null;
    navigator.vibrate?.(45);
  }

  const title = register ? 'Create your account' : 'Sign in';
  return (
    <dialog
      ref={dialog}
      className={selecting ? 'account-dialog account-institution-dialog' : 'account-dialog'}
      aria-labelledby="account-title"
      aria-describedby={selecting ? undefined : 'account-description'}
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
      {selecting ? (
        <div className="account-institution-card">
          <img className="account-institution-image" src="/media/institution-sign-in.webp" alt="" />
          <form
            className="account-institution-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSelecting(false);
              closeButton.current?.focus();
            }}
          >
            <img src={media.logo} width={90} height={90} alt="YERH" />
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
                {yerh && <option value="yerh">YERH</option>}
                {institutions.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button account-submit">
              Continue <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      ) : (
        <div className="account-card" ref={card}>
          <Link className="account-brand" to="/" aria-label="YERH home" onClick={close}>
            <img src={media.logo} width={104} height={104} alt="" fetchPriority="high" />
          </Link>
          <AccountForm
            key={String(register)}
            title={title}
            register={register}
            institution={institution}
            onChangeInstitution={register ? undefined : () => setSelecting(true)}
            search={search}
            onGoogleUnavailable={signalUnavailable}
            onSwitch={() => {
              closeButton.current?.focus();
              setRegister(!register);
              setSelecting(register);
            }}
          />
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
  onChangeInstitution,
}: {
  title: string;
  register: boolean;
  institution: string;
  search: string;
  onSwitch: () => void;
  onGoogleUnavailable: () => void;
  onChangeInstitution?: () => void;
}) {
  const { account, state, enabled, execute, error } = useDemo();
  const navigate = useNavigate();
  const [termsOpen, setTermsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionFailed, setActionFailed] = useState(false);
  const host = platformHref(register ? '/register' : '/login');
  const destination = accountDestination(search, '/dashboard');
  const institutions = state.platform.training.institutions.filter(
    (school) => school.status === 'active',
  );
  const message = notice || (actionFailed ? error : '');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || account) return;
    setNotice('');
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
      if (created) navigate('/dashboard', { replace: true });
      return;
    }

    const member = state.accounts.find((person) => person.email.toLowerCase() === email);
    if (!member) {
      setActionFailed(false);
      setNotice('No preview account uses that email. Check the address or create an account.');
      return;
    }
    const signedIn = execute({ type: 'login', accountId: member.id });
    setActionFailed(!signedIn);
    if (signedIn) {
      const school = institutions.find((entry) => entry.id === institution);
      const access = school && institutionAccess(school, member);
      navigate(
        school && access && destination === '/dashboard'
          ? institutionHref(access === 'manage' ? 'school' : 'member-results', school.id)
          : destination,
        { replace: true },
      );
    }
  }

  function signOut() {
    setNotice('');
    setActionFailed(!execute({ type: 'logout' }));
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
          ) : (
            <>
              <p>
                You’re signed in as <strong>{account.name}</strong>.
              </p>
              <Link className="button account-submit" to={destination}>
                Continue <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </>
          )}
          <button className="account-link" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : enabled ? (
        <form className="account-form" onSubmit={submit}>
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
                Institution (optional)
                <select name="institution" defaultValue={institution}>
                  <option value="">No institution selected</option>
                  {state.platform.training.yerhSignIn !== false && (
                    <option value="yerh">YERH</option>
                  )}
                  {institutions.map((school) => (
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
