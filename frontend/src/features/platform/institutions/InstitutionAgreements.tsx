import { useState } from 'react';
import type { DemoAccount } from '../../../domain/demo';
import type { Institution } from '../../../domain/incubation';
import { AgreementTerms } from './AgreementTerms';
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
