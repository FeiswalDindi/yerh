import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { DemoNotice } from '../demo/DemoNotice';
import { AccountLink } from './AccountLink';

export function ApplicationsPage() {
  usePageTitle('Apply for incubation');

  return (
    <>
      <PageIntro
        eyebrow="Incubation Pathway"
        title="Apply for incubation"
        description="Sign in to select your affiliated university or hub, submit an application, and follow YERH’s decision."
      />
      <section className="container section narrow-content">
        <DemoNotice />
        <div className="empty-state">
          <h2>Sign in before applying</h2>
          <AccountLink
            className="button"
            mode="register"
            search="?redirect=%2Faccount%23incubation"
          >
            Create an account
          </AccountLink>
          <AccountLink search="?redirect=%2Faccount%23incubation">
            Already have an account? Sign in
          </AccountLink>
        </div>
      </section>
    </>
  );
}
