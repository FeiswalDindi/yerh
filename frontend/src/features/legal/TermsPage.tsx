import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { usePageTitle } from '../../shared/usePageTitle';
import { PageIntro } from '../../shared/PageIntro';

export function TermsText({ text }: { text: string }) {
  return (
    <>
      {text.split('Privacy Notice').map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <Link to="/privacy">Privacy Notice</Link>}
          {part}
        </Fragment>
      ))}
    </>
  );
}
export function TermsPage() {
  const { terms } = useCatalog();
  usePageTitle('Terms & conditions');
  return (
    <>
      <PageIntro eyebrow="Terms & conditions" title={terms.title} description={terms.intro} />
      <section className="container section terms-page">
        <div className="terms-document">
          <p className="terms-effective">
            Effective{' '}
            {new Date(`${terms.effectiveDate}T12:00:00Z`).toLocaleDateString('en-KE', {
              dateStyle: 'long',
              timeZone: 'Africa/Nairobi',
            })}
          </p>
          {terms.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((text, index) => (
                <p key={index}>
                  <TermsText text={text} />
                </p>
              ))}
              {section.title === 'Contact' && (
                <a href={`mailto:${terms.contactEmail}`}>{terms.contactEmail}</a>
              )}
            </section>
          ))}
        </div>
        <p className="source-note">
          These are the YERH platform terms from Feiso. This frontend's demo actions are local;
          platform services described above require the connected backend.
        </p>
        <Link className="text-link" to="/contact">
          Contact the YERH team →
        </Link>
      </section>
    </>
  );
}
