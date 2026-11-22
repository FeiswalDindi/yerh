import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { activeIncubationPartner } from '../../domain/incubation';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DemoNotice } from '../demo/DemoNotice';
import { AccountLink } from './AccountLink';

export function InstitutionInvitationPage() {
  const { id } = useParams();
  const { enabled, state, account, execute, error } = useDemo();
  const navigate = useNavigate();
  usePageTitle('Institution invitation');
  const invitation = enabled && state.platform.institutionInvitations?.find((row) => row.id === id);
  const institution =
    invitation && activeIncubationPartner(state.platform, invitation.institutionId);
  const existing =
    invitation && state.accounts.find((row) => row.email.toLowerCase() === invitation.email);
  const url = `/account/invitations/${encodeURIComponent(id ?? '')}`;
  const wrongAccount = account && account.id !== (existing && existing.id);
  return (
    <>
      <PageIntro
        eyebrow="YERH"
        title="Institution invitation"
        description={
          institution
            ? `Join ${institution.name} on YERH.`
            : 'Activate your YERH membership from an institutional invitation.'
        }
      />
      <section className="container section narrow-content">
        <DemoNotice />
        {!invitation || invitation.status !== 'pending' || !institution ? (
          <div className="profile-panel">
            <h2>Invitation unavailable</h2>
            <Link to={account && account.role !== 'guest' ? '/dashboard' : '/learn'}>
              Continue to YERH
            </Link>
          </div>
        ) : wrongAccount ? (
          <div className="profile-panel">
            <p>Sign out to accept the invitation for the invited email.</p>
            <button className="button" type="button" onClick={() => execute({ type: 'logout' })}>
              Sign out
            </button>
          </div>
        ) : existing && !account ? (
          <div className="profile-panel">
            <p>
              Sign in with the invited email to keep your existing courses and event reservations.
            </p>
            <AccountLink
              className="button"
              search={`?${new URLSearchParams({ redirect: url, institution: institution.id })}`}
            >
              Sign in
            </AccountLink>
          </div>
        ) : (
          <form
            className="workspace-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              if (
                execute({
                  type: 'institution-invite-accept',
                  id: invitation.id,
                  accountId: account?.id ?? `member-${crypto.randomUUID()}`,
                  location: String(data.get('location') ?? ''),
                  consent: data.get('terms') === 'on',
                  now: new Date().toISOString(),
                })
              )
                navigate('/dashboard', { replace: true });
            }}
          >
            <h2>{existing ? 'Accept your invitation' : 'Activate your demo account'}</h2>
            <p>
              {invitation.name} · {invitation.email}
            </p>
            {!existing && (
              <>
                <p>
                  Use the invited email for future demo sign-ins. Account activation is simulated in
                  this browser.
                </p>
                <label>
                  City or county
                  <input
                    name="location"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="address-level2"
                  />
                </label>
                <label className="inline-checkbox">
                  <input type="checkbox" name="terms" required /> I accept the{' '}
                  <Link to="/terms">terms</Link> and <Link to="/privacy">privacy notice</Link>.
                </label>
              </>
            )}
            {error && <p role="alert">{error}</p>}
            <button type="submit" className="button">
              {existing ? 'Accept invitation' : 'Activate demo account'}
            </button>
          </form>
        )}
      </section>
    </>
  );
}
