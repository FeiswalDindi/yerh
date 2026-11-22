import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../app/useCatalog';
import { useDemo } from '../../app/useDemo';
import { can } from '../../domain/roles';
import { courseCertificateQueue, courseCompletionKey } from '../../domain/courses';
import { PageIntro } from '../../shared/PageIntro';
import { usePageTitle } from '../../shared/usePageTitle';
import { dashboardCataloguePaths } from './catalogue-paths';
import { credentialTitle } from '../platform/incubation/TrainingForms';
import { WorkspaceTable } from '../platform/workspace/WorkspaceControls';

export function DashboardCertificates({ publicAccount = false }: { publicAccount?: boolean }) {
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
  const pending = courseCertificateQueue(state)
    .filter((record) => record.accountId === account.id)
    .map((record) => ({
      id: courseCompletionKey(record),
      title: courses.find((course) => course.id === record.courseId)?.title ?? 'Course completion',
      category: 'Course',
      issuedAt: '',
    }));
  return (
    <>
      <PageIntro
        eyebrow="Certificates"
        title="Certificates"
        description="Track course certificates and view issued certificates."
        className="workspace-page-intro"
      />
      <section className="container section workspace-content">
        <WorkspaceTable
          label="certificates"
          columns={['Certificate', 'Venture or type', 'Certificate status', 'Issued', 'Action']}
          empty="No certificates yet"
          actions={
            can(account, 'learn') && (
              <Link
                className="button button-outline workspace-action"
                to={publicAccount ? '/learn' : dashboardCataloguePaths.learning}
              >
                Browse courses <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )
          }
          rows={[...pending, ...records].map((record) => ({
            id: record.id,
            search: [record.title, record.category].join(' '),
            cells: [
              record.title,
              record.category,
              record.issuedAt ? 'Issued' : 'Awaiting issuance',
              record.issuedAt
                ? new Date(record.issuedAt).toLocaleDateString('en-KE', {
                    dateStyle: 'medium',
                    timeZone: 'Africa/Nairobi',
                  })
                : '—',
              record.issuedAt ? (
                <Link to={'/certificates/' + record.id} aria-label="View certificate">
                  View
                </Link>
              ) : (
                '—'
              ),
            ],
          }))}
        />
      </section>
    </>
  );
}
