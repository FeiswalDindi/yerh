import { useParams } from 'react-router-dom';
import { useDemo } from '../../../app/useDemo';
import { useCatalog } from '../../../app/useCatalog';
import { NotFoundPage } from '../../info/NotFoundPage';
import { usePageTitle } from '../../../shared/usePageTitle';
import { can } from '../../../domain/roles';
import { institutionAccess } from '../../../domain/incubation';
import { certificateDetails, credentialTitle } from './TrainingForms';
export function CertificatePage() {
  const { id } = useParams();
  const { state, account } = useDemo();
  const { courses } = useCatalog();
  const record = state.platform.certificates.find((c) => c.id === id);
  const training = state.platform.training;
  const credential = training.credentials.find((c) => c.id === id);
  const path =
    credential && state.platform.incubations.find((row) => row.id === credential.incubationId);
  const student = credential && training.students.find((row) => row.id === credential.learnerId);
  const venture = path && state.platform.ventures.find((row) => row.id === path.ventureId);
  usePageTitle('Completion verification');
  if (credential && path && venture) {
    const school = student && training.institutions.find((row) => row.id === student.institutionId);
    if (
      student &&
      !(account && school && institutionAccess(school, account)) &&
      !can(account, 'admin')
    )
      return <NotFoundPage />;
    const { division, achievements } = certificateDetails(state.platform, credential);
    return (
      <section className="container section narrow-content">
        <div className="terms-document training-certificate">
          <p className="eyebrow">YERH · DEVELOPMENT DEMO</p>
          <h1>{credentialTitle(training, credential.kind)}</h1>
          <h2>
            {student?.name ?? state.accounts.find((row) => row.id === credential.learnerId)?.name}
          </h2>
          <p>
            {student ? 'School venture participant' : 'Venture owner'} · {venture.name}
          </p>
          {division && (
            <p>
              <strong>Classification</strong> · {division}
            </p>
          )}
          {achievements.length > 0 && (
            <>
              <h3>Achievements</h3>
              <ul>
                {achievements.map((achievement) => (
                  <li key={achievement}>{achievement}</li>
                ))}
              </ul>
            </>
          )}
          <p>
            Issued{' '}
            {new Date(credential.issuedAt).toLocaleDateString('en-KE', {
              dateStyle: 'medium',
              timeZone: 'Africa/Nairobi',
            })}
          </p>
          <p>Record ID: {credential.id}</p>
          <p className="source-note">
            This certificate verifies a browser-local demonstration record.
          </p>
          <button
            type="button"
            className="button button-outline training-certificate-print"
            onClick={() => window.print()}
          >
            Print certificate
          </button>
        </div>
      </section>
    );
  }
  if (!record) return <NotFoundPage />;
  return (
    <section className="container section narrow-content">
      <div className="terms-document training-certificate">
        <p className="eyebrow">YERH · DEVELOPMENT DEMO</p>
        <h1>Course completion certificate</h1>
        <h2>{state.accounts.find((a) => a.id === record.accountId)?.name}</h2>
        <p>Completed {courses.find((c) => c.id === record.courseId)?.title ?? 'a YERH course'}</p>
        <p>
          Issued{' '}
          {new Date(record.issuedAt).toLocaleDateString('en-KE', {
            dateStyle: 'medium',
            timeZone: 'Africa/Nairobi',
          })}
        </p>
        <p>Record ID: {record.id}</p>
        <p className="source-note">
          This is a browser-local demonstration of administrator-issued completion records. It is
          not an accredited qualification or a production certificate.
        </p>
        <button
          type="button"
          className="button button-outline training-certificate-print"
          onClick={() => window.print()}
        >
          Print certificate
        </button>
      </div>
    </section>
  );
}
