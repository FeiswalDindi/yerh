import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DemoNotice } from '../demo/DemoNotice';
import { AccountLink } from './AccountLink';
import { roleAccessPath } from './role-requests';

export function ApplicationsPage() {
  usePageTitle('Apply for a role');

  return (
    <>
      <PageIntro
        eyebrow="Role application"
        title="Apply for a role"
        description="Sign in to manage your role and follow the administrator’s decision in My profile."
      />
      <section className="container section narrow-content">
        <DemoNotice />
        <div className="empty-state">
          <h2>Sign in before applying</h2>
          <AccountLink className="button" mode="register">
            Create an account
          </AccountLink>
          <AccountLink search={`?${new URLSearchParams({ redirect: roleAccessPath })}`}>
            Already have an account? Sign in
          </AccountLink>
        </div>
      </section>
    </>
  );
}
