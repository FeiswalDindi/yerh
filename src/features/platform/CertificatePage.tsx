import { useParams, Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { useCatalog } from '../../app/useCatalog';
import { NotFoundPage } from '../info/NotFoundPage';
import { usePageTitle } from '../../shared/usePageTitle';
export function CertificatePage() {
  const { id } = useParams();
  const { state } = useDemo();
  const { courses } = useCatalog();
  const record = state.platform.certificates.find((c) => c.id === id);
  usePageTitle('Completion verification');
  if (!record) return <NotFoundPage />;
  return (
    <section className="container section narrow-content">
      <div className="terms-document">
        <p className="eyebrow">LOCAL DEMO COMPLETION RECORD</p>
        <h1>Course completion</h1>
        <h2>{courses.find((c) => c.id === record.courseId)?.title}</h2>
        <p>{state.accounts.find((a) => a.id === record.accountId)?.name}</p>
        <p>Issued {new Date(record.issuedAt).toLocaleDateString('en-KE')}</p>
        <p>Record ID: {record.id}</p>
        <p className="source-note">
          This is a browser-local demonstration of administrator-issued completion records. It is
          not an accredited qualification or a production certificate.
        </p>
        <Link to="/learn">Explore learning pathways →</Link>
      </div>
    </section>
  );
}
