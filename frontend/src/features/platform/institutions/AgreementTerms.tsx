import { passMark, schoolCertificateClassifications } from '../../../domain/incubation';
import { WorkspaceDialog } from '../workspace/WorkspaceControls';
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

export function AgreementTerms({
  school,
  terms,
  historical = false,
}: {
  school: { name: string; kind: string };
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
                    {school.kind === 'high-school'
                      ? 'One school term of venture incubation with class activities, team projects, and stage assessments.'
                      : 'Members undertake venture incubation at their own pace, with stage assessments and access to programme resources.'}
                  </dd>
                </div>
                <div>
                  <dt>Institution commitments</dt>
                  <dd>
                    {school.kind === 'high-school'
                      ? 'Appoint a programme lead, supervise teams, and record attendance and marks.'
                      : 'Appoint a programme lead, maintain the member register, and monitor participation and pathway progress.'}
                  </dd>
                </div>
                <div>
                  <dt>YERH commitments</dt>
                  <dd>
                    Provide the pathway materials, review programme assessment evidence, and issue
                    certificates for eligible learners.
                  </dd>
                </div>
                <div>
                  <dt>Learner records</dt>
                  <dd>
                    Use student information for programme delivery and reporting. Share public
                    success stories only with the institution’s permission.
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
