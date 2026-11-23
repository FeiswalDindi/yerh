import { useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { localLaravelIdentity } from './services/laravel-identity-repository';
import { localInstitution } from './services/local-institution-repository';
import './features/accounts/LocalLaravelAccountPage.css';

type Task = (value: FormData) => Promise<string>;

function Form({
  label,
  button,
  action,
  children,
}: {
  label: string;
  button: string;
  action: Task;
  children: ReactNode;
}) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = event.currentTarget;
    const data = new FormData(current);
    setBusy(true);
    setStatus('');
    setError('');
    try {
      setStatus(await action(data));
      current.reset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The local request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form aria-label={label} onSubmit={(event) => void submit(event)}>
      <h2>{label}</h2>
      {children}
      <button disabled={busy} type="submit">
        {busy ? 'Please wait…' : button}
      </button>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? '').trim();
}

function Slug() {
  return (
    <label>
      Institution slug
      <input name="slug" required maxLength={120} />
    </label>
  );
}

function InstitutionPreview() {
  const [profile, setProfile] =
    useState<Awaited<ReturnType<typeof localLaravelIdentity.profile>>>(null);
  const [checked, setChecked] = useState(false);
  const [profileError, setProfileError] = useState('');
  async function checkSession() {
    try {
      setProfile(await localLaravelIdentity.profile());
      setChecked(true);
      setProfileError('');
    } catch (failure) {
      setProfileError(failure instanceof Error ? failure.message : 'The local request failed.');
    }
  }
  return (
    <main className="local-account">
      <section className="local-account__panel">
        <p className="local-account__label">Local development · fictional accounts only</p>
        <h1>YERH institution invitations</h1>
        <p>
          <a href="/local-account">Sign in or sign out on the Laravel account screen</a>, then
          return here on the same port.
        </p>
        <button type="button" onClick={() => void checkSession()}>
          Check current session
        </button>
        {checked && (
          <p role="status">
            {profile
              ? profile.name +
                ' · ' +
                profile.role +
                (profile.email_verified ? ' · email verified' : ' · email not verified')
              : 'No signed-in Laravel account.'}
          </p>
        )}
        {profileError && <p role="alert">{profileError}</p>}
        <Form
          label="Check institution access"
          button="Check access"
          action={async (data) => {
            const scope = await localInstitution.access(text(data, 'slug'));
            return (
              scope.institution +
              ': ' +
              (scope.access === 'manage' ? 'Manage' : 'View only') +
              ' access.'
            );
          }}
        >
          <Slug />
        </Form>
        <Form
          label="Issue an invitation"
          button="Issue invitation"
          action={async (data) => {
            const id = await localInstitution.issue(text(data, 'slug'), {
              name: text(data, 'name'),
              email: text(data, 'email'),
            });
            return 'Invitation ' + id + ' queued. The code is sent only to the invited address.';
          }}
        >
          <Slug />
          <label>
            Recipient name
            <input name="name" minLength={2} maxLength={80} required />
          </label>
          <label>
            Recipient email
            <input name="email" type="email" maxLength={254} required />
          </label>
        </Form>
        <Form
          label="Revoke an invitation"
          button="Revoke invitation"
          action={async (data) => {
            await localInstitution.revoke(text(data, 'slug'), text(data, 'id'));
            return 'Invitation revoked.';
          }}
        >
          <Slug />
          <label>
            Invitation ID
            <input name="id" inputMode="numeric" pattern="[0-9]+" required />
          </label>
        </Form>
        <Form
          label="Accept an invitation"
          button="Accept invitation"
          action={async (data) => {
            const accepted = await localInstitution.accept(
              text(data, 'token'),
              text(data, 'location'),
              data.has('consent'),
            );
            void checkSession();
            return 'Joined ' + accepted.institution + ' as ' + accepted.role + '.';
          }}
        >
          <label>
            Invitation code
            <input name="token" autoComplete="off" minLength={64} maxLength={64} required />
          </label>
          <label>
            Location
            <input name="location" maxLength={120} required />
          </label>
          <label>
            <span>
              <input name="consent" type="checkbox" required /> I consent to joining this
              institution on YERH.
            </span>
          </label>
        </Form>
      </section>
    </main>
  );
}

const root = document.getElementById('root');

if (!root) throw new Error('Missing local institution preview root.');

const enabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_INSTITUTION === 'true';
createRoot(root).render(enabled ? <InstitutionPreview /> : <p>This local preview is disabled.</p>);
