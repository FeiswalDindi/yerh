import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { can } from '../../domain/roles';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { dashboardCataloguePaths } from './catalogue-paths';
import { credentialTitle } from '../platform/TrainingForms';
import { WorkspaceTable } from '../platform/WorkspaceControls';

export function DashboardCertificates() {
  const { state, account } = useDemo();
  const { courses } = useCatalog();
  usePageTitle('Certificates');
  if (!account) return null;
  const certificates = state.platform.certificates.filter(
    (record) => record.accountId === account.id,
  );
  const training = state.platform.training;
  const incubationCertificates = training.credentials.filter(
    (record) => record.learnerId === account.id,
  );

  const records = [
    ...incubationCertificates.map((record) => {
      const path = state.platform.incubations.find((path) => path.id === record.incubationId);
      const venture = state.platform.ventures.find((venture) => venture.id === path?.ventureId);
      return {
        id: record.id,
        title: credentialTitle(training, record.kind),
        category: venture?.name ?? 'Venture',
        issuedAt: record.issuedAt,
      };
    }),
    ...certificates.map((record) => ({
      id: record.id,
      title: courses.find((course) => course.id === record.courseId)?.title ?? 'Course completion',
      category: 'Course',
      issuedAt: record.issuedAt,
    })),
  ].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  return (
    <>
      <PageIntro
        eyebrow="Certificates"
        title="Certificates"
        description="View your issued incubation and course certificates."
        className="workspace-page-intro"
      />
      <section className="container section workspace-content">
        <WorkspaceTable
          label="certificates"
          columns={['Certificate', 'Venture or type', 'Issued', 'Action']}
          empty="No certificates yet"
          actions={
            can(account, 'learn') && (
              <Link
                className="button button-outline workspace-action"
                to={dashboardCataloguePaths.learning}
              >
                Browse courses <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )
          }
          rows={records.map((record) => ({
            id: record.id,
            search: [record.title, record.category].join(' '),
            cells: [
              record.title,
              record.category,
              new Date(record.issuedAt).toLocaleDateString('en-KE', {
                dateStyle: 'medium',
                timeZone: 'Africa/Nairobi',
              }),
              <Link to={'/certificates/' + record.id} aria-label="View certificate">
                View
              </Link>,
            ],
          }))}
        />
      </section>
    </>
  );
}
