import { useState } from 'react';
import type { DemoAccount } from '../../../domain/demo';
import type { Institution } from '../../../domain/incubation';
import { passMark, schoolCertificateClassifications } from '../../../domain/incubation';
import { submitTraining, type Save } from '../incubation/TrainingForms';
import { WorkspaceDialog, WorkspaceTable } from '../workspace/WorkspaceControls';

export function AgreementUpload({
  school,
  save,
  finish,
}: {
  school: Institution;
  save: Save;
  finish: (saved: boolean) => void;
}) {
  const [error, setError] = useState('');
  return (
    <form
      className="workspace-form"
      onSubmit={(event) => {
        event.preventDefault();
        const file = new FormData(event.currentTarget).get('agreement');
        if (
          !(file instanceof File) ||
          !file.size ||
          file.size > 250 * 1024 ||
          file.type !== 'application/pdf'
        ) {
          setError('Choose a demonstration PDF no larger than 250 KB.');
          return;
        }
        setError('');
        const reader = new FileReader();
        reader.onerror = () => setError('The selected file could not be read.');
        reader.onload = () =>
          finish(
            submitTraining(save, {
              type: 'institution-proof',
              id: school.id,
              name: file.name,
              data: String(reader.result),
            }),
          );
        reader.readAsDataURL(file);
      }}
    >
      <label>
        Signed agreement and required payment proof (demo PDF)
        <input name="agreement" type="file" accept="application/pdf,.pdf" required />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-outline">Upload agreement proof</button>
    </form>
  );
}

function SchoolAssessmentTerms() {
  return (
    <section className="agreement-assessment-terms" aria-label="Assessment and certification">
      <h3>Assessment and certification</h3>
      <p>
        The pass benchmark is {passMark}%. Any recorded assessment score, including 0%, completes
        the stage and makes the student eligible for its certificate. The next stage opens as soon
        as the score is recorded.
      </p>
      <div className="workspace-data-scroll">
        <table
          className="workspace-data-table"
          aria-label="High-school certificate classifications"
        >
          <thead>
            <tr>
              <th scope="col">High-school score</th>
              <th scope="col">Certificate classification</th>
            </tr>
          </thead>
          <tbody>
            {schoolCertificateClassifications.map(({ minimum, label }, index) => {
              const upper = schoolCertificateClassifications[index - 1]?.minimum;
              const range =
                upper === undefined
                  ? `${minimum}% and above`
                  : minimum === 0
                    ? `Below ${upper}%`
                    : `${minimum}% to under ${upper}%`;
              return (
                <tr key={label}>
                  <th scope="row">{range}</th>
                  <td>{label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Each stage certificate uses the score for that stage. The final venture certificate requires
        a score for all three stages and uses the average of those scores.
      </p>
      <p>
        School administrators request certificates in <strong>Results &amp; Certificates</strong>.
        YERH reviews the requests and issues approved school certificates free of charge.
      </p>
    </section>
  );
}

function AgreementTerms({
  school,
  terms,
  historical = false,
}: {
  school: Institution;
  terms?: string;
  historical?: boolean;
}) {
  return (
    <WorkspaceDialog
      action="View"
      title={historical ? 'Agreement terms at upload' : 'Institution agreement terms'}
    >
      {() => (
        <>
          {terms?.trim() ? (
            <p className="workspace-detail-copy">{terms}</p>
          ) : (
            <>
              <p>
                <strong>Sample agreement</strong> · YERH and {school.name}
              </p>
              <dl className="workspace-profile">
                <div>
                  <dt>Programme</dt>
                  <dd>
                    One school term of venture incubation with class activities, team projects, and
                    stage assessments.
                  </dd>
                </div>
                <div>
                  <dt>School commitments</dt>
                  <dd>
                    Appoint a programme lead, supervise teams, and record attendance and marks.
                  </dd>
                </div>
                <div>
                  <dt>YERH commitments</dt>
                  <dd>
                    Provide the pathway materials, review the school’s assessment evidence, and
                    issue certificates for eligible learners.
                  </dd>
                </div>
                <div>
                  <dt>Learner records</dt>
                  <dd>
                    Use student information for programme delivery and reporting. Share public
                    success stories only with the school’s permission.
                  </dd>
                </div>
                <div>
                  <dt>End-of-term review</dt>
                  <dd>
                    Both teams review participation and results before agreeing on the next cohort.
                  </dd>
                </div>
              </dl>
            </>
          )}
          {!historical && school.kind === 'high-school' && <SchoolAssessmentTerms />}
        </>
      )}
    </WorkspaceDialog>
  );
}

export function AgreementsPanel({
  school,
  accounts,
  save,
}: {
  school: Institution;
  accounts: DemoAccount[];
  save: Save;
}) {
  const documents = school.agreements?.length
    ? school.agreements
    : school.proof
      ? [
          {
            id: school.id + ':original',
            ...school.proof,
            addedAt: '',
            addedBy: '',
            amount: school.amount,
            terms: school.intake?.terms ?? '',
          },
        ]
      : [];
  return (
    <>
      <h3>Agreements</h3>
      <dl className="workspace-profile">
        <div>
          <dt>Institution</dt>
          <dd>{school.name}</dd>
        </div>
        <div>
          <dt>Agreed terms</dt>
          <dd>
            <AgreementTerms school={school} terms={school.intake?.terms} />
          </dd>
        </div>
      </dl>
      <WorkspaceTable
        label="agreement documents"
        columns={['Document', 'Terms at upload', 'Added by', 'Date', 'Action']}
        actions={
          <WorkspaceDialog action="Upload agreement" create>
            {(finish) => <AgreementUpload school={school} save={save} finish={finish} />}
          </WorkspaceDialog>
        }
        rows={[...documents].reverse().map((document) => {
          const author = accounts.find((row) => row.id === document.addedBy)?.name ?? '—';
          return {
            id: document.id,
            search: [document.name, author, document.terms].join(' '),
            cells: [
              document.name,
              <AgreementTerms school={school} terms={document.terms} historical />,
              author,
              document.addedAt
                ? new Date(document.addedAt).toLocaleDateString('en-KE', {
                    dateStyle: 'medium',
                    timeZone: 'Africa/Nairobi',
                  })
                : '—',
              <a href={document.data} download={document.name}>
                Download PDF
              </a>,
            ],
          };
        })}
      />
    </>
  );
}
