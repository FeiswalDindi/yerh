import { useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert, FlaskConical } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { platformHref } from '../../config/site';
import { usePageTitle } from '../../shared/usePageTitle';
import { TermsDialog } from '../legal/TermsDialog';
import { accountDestination } from './account-navigation';
import './account.css';

export function AccountPage({ register = false }: { register?: boolean }) {
  const { account, state, enabled, execute, error } = useDemo();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [termsOpen, setTermsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionFailed, setActionFailed] = useState(false);
  const title = register ? 'Create your account' : 'Sign in to YERH';
  const host = platformHref(register ? '/register' : '/login');
  const destination = accountDestination(search, '/dashboard');
  const message = notice || (actionFailed ? error : '');
  usePageTitle(title);

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
    if (signedIn) navigate(destination, { replace: true });
  }

  function signOut() {
    setNotice('');
    setActionFailed(!execute({ type: 'logout' }));
  }

  return (
    <div className="account-page">
      <section className="account-card" aria-labelledby="account-title">
        <header className="account-heading">
          <h1 id="account-title">{title}</h1>
          <p>
            {register
              ? 'Join the Youth Entrepreneurship Resource Hub.'
              : 'Access your YERH workspace.'}
          </p>
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
                <div className="account-agreement">
                  <label className="account-checkbox">
                    <input type="checkbox" name="terms" required />
                    <span>I accept the terms and privacy notice.</span>
                  </label>
                  <div className="account-legal-links">
                    <button
                      className="account-link"
                      type="button"
                      onClick={() => setTermsOpen(true)}
                    >
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
          <p className="account-switch">
            {register ? 'Already have an account?' : 'New to YERH?'}{' '}
            <Link className="account-link" to={register ? `/login${search}` : `/register${search}`}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        )}
        {account && message && (
          <p className="account-error" role="alert">
            {message}
          </p>
        )}
      </section>

      {enabled && (
        <aside className="account-preview" aria-label="Development preview">
          <FlaskConical size={17} aria-hidden="true" />
          <p>
            Development preview. Use a test email.
            {host && (
              <>
                {' '}
                <a className="account-link" href={host}>
                  Open live account portal
                </a>
              </>
            )}
          </p>
          <Link className="account-link" to={`/demo${search}`}>
            Demo accounts
          </Link>
        </aside>
      )}
      {termsOpen && <TermsDialog onClose={() => setTermsOpen(false)} />}
    </div>
  );
}
