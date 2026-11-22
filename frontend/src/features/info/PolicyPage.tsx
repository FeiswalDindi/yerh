import { Link } from 'react-router-dom';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
export function PolicyPage() {
  usePageTitle('Privacy in this preview');
  return (
    <>
      <PageIntro
        eyebrow="Privacy"
        title="Your browsing, simply explained."
        description="Information about the standalone YERH frontend."
      />
      <section className="container section policy-copy">
        <>
          <h2>Saved on your device</h2>
          <p>
            Bookmarked resources and development demo activity (profiles, drafts, discussions,
            memberships, mentorship requests, and learning progress) are saved in your browser’s
            local storage. Reset the demo from the Login page to remove its activity. This preview
            does not create accounts, collect analytics, or send form submissions to a server. You
            can remove bookmarks individually or clear this site’s browser data.
          </p>
          <h2>Email enquiries</h2>
          <p>
            The contact form prepares a draft in your email application. Your details stay in the
            page until you choose to open and send the draft. Reloading the page clears the form.
          </p>
          <h2>External destinations</h2>
          <p>
            YouTube videos, partner websites, and original publications open on external services
            with their own privacy practices.
          </p>
        </>
        <p>
          For the original website’s published policy, see{' '}
          <a href="https://yerh-kenya.kcau.ac.ke/privacy-policy/" target="_blank" rel="noreferrer">
            the original privacy policy
          </a>
          .
        </p>
        <Link className="text-link" to="/contact">
          Contact the YERH team
        </Link>
      </section>
    </>
  );
}
