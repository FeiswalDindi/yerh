import { AgreementTerms } from '../institutions/AgreementTerms';
import { useCallback } from 'react';
import { laravelRequest } from '../../../services/laravel-api';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import { RecordsFeedback, useWorkspaceRecords, WorkspaceAction } from './WorkspaceActions';

const base = (slug: string) =>
  '/workspace/institutions/' + encodeURIComponent(slug) + '/agreements';

export function UploadInstitutionAgreement({
  slug,
  onSaved,
}: {
  slug: string;
  onSaved?: () => void;
}) {
  return (
    <WorkspaceAction
      action="Add agreement"
      create
      submit="Save agreement"
      save={async (form) => {
        await laravelRequest(base(slug), { method: 'POST', data: form });
        onSaved?.();
      }}
    >
      <label>
        Agreement reference
        <input name="reference" maxLength={180} required />
      </label>
      <label>
        Signed agreement (PDF)
        <input name="document" type="file" accept="application/pdf" required />
      </label>
    </WorkspaceAction>
  );
}

export function InstitutionAgreements({
  slug,
  reference,
  school,
  admin,
}: {
  slug: string;
  reference: string | null;
  school: { name: string; kind: string };
  admin: boolean;
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      return (
        await laravelRequest<{ data: { id: number; reference: string; created_at: string }[] }>(
          base(slug),
          { signal },
        )
      ).data;
    },
    [slug],
  );
  const { records, error, reload } = useWorkspaceRecords(load);

  return (
    <>
      <dl className="workspace-profile">
        <div>
          <dt>Institution</dt>
          <dd>{school.name}</dd>
        </div>
        <div>
          <dt>Agreed terms</dt>
          <dd>
            <AgreementTerms school={school} />
          </dd>
        </div>
      </dl>
      {reference && (
        <p>
          Agreement reference <strong>{reference}</strong>
        </p>
      )}
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="agreements"
          columns={['Agreement', 'Uploaded', 'Action']}
          actions={admin && <UploadInstitutionAgreement slug={slug} onSaved={reload} />}
          rows={records.map((record) => ({
            id: String(record.id),
            search: record.reference,
            cells: [
              record.reference,
              record.created_at.slice(0, 10),
              <a href={'/api/v1' + base(slug) + '/' + record.id}>Download</a>,
            ],
          }))}
        />
      )}
    </>
  );
}
