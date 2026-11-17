import { ArrowRight, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { can } from '../../domain/roles';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { dashboardCataloguePaths } from './catalogue-paths';

export function DashboardCertificates() {
  const { state, account } = useDemo();
  const { courses } = useCatalog();
  usePageTitle('My certificates');
  if (!account) return null;
  const certificates = state.platform.certificates.filter(
    (record) => record.accountId === account.id,
  );

  return (
    <>
      <PageIntro
        eyebrow="My certificates"
        title="My certificates"
        description="View the course completion records issued to your account."
        className="dashboard-pane-intro"
      />
      <section className="container section dashboard-activity">
        {can(account, 'learn') && (
          <Link className="button" to={dashboardCataloguePaths.learning}>
            Browse courses <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
        {!certificates.length && (
          <div className="empty-state">
            <h2>No certificates yet</h2>
            <p>
              Complete a course to qualify for a completion record. Certificates appear here after
              they’re issued.
            </p>
          </div>
        )}
        {certificates.map((record) => (
          <article className="workspace-record" key={record.id}>
            <h2>
              {courses.find((course) => course.id === record.courseId)?.title ??
                'Course completion'}
            </h2>
            <p>
              Issued{' '}
              {new Date(record.issuedAt).toLocaleDateString('en-KE', {
                dateStyle: 'medium',
                timeZone: 'Africa/Nairobi',
              })}
            </p>
            <Link className="text-link" to={`/certificates/${record.id}`}>
              <Award size={16} aria-hidden="true" /> View certificate
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}
