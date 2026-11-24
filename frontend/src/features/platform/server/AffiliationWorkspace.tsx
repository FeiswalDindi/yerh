import { WorkspaceTable } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import { localLaravelIdentity } from '../../../services/laravel-identity-repository';
import { localInstitution } from '../../../services/local-institution-repository';
import {
  DecisionAction,
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

export function AffiliationWorkspace({
  admin = false,
  refresh,
}: {
  admin?: boolean;
  refresh?: () => Promise<void>;
}) {
  const { records, error, reload } = useWorkspaceRecords(laravelWorkspace.applications);
  const pending = records?.some((entry) => entry.status === 'pending');
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="affiliation applications"
          columns={
            admin
              ? ['Applicant', 'Institution', 'Details', 'Decision', 'Action']
              : ['Institution', 'Details', 'Decision']
          }
          actions={
            !admin && (
              <div className="workspace-row-actions">
                {!pending && <AffiliationForm reload={reload} />}
                <WorkspaceAction
                  action="Accept invitation"
                  submit="Accept invitation"
                  save={async (data) => {
                    await localInstitution.accept(
                      fieldValue(data, 'token'),
                      fieldValue(data, 'location'),
                      data.get('consent') === 'on',
                    );
                    await refresh?.();
                  }}
                >
                  <label>
                    Invitation code
                    <input name="token" required minLength={64} maxLength={64} autoComplete="off" />
                  </label>
                  <LocationConsent />
                </WorkspaceAction>
              </div>
            )
          }
          rows={records.map((entry) => ({
            id: String(entry.id),
            search: [entry.applicant, entry.institution, entry.status, entry.location].join(' '),
            cells: [
              ...(admin ? [entry.applicant] : []),
              entry.institution,
              <>
                <p>{entry.details}</p>
                <p>{entry.location}</p>
              </>,
              <>
                <StatusIndicator status={entry.status} />
                {entry.decision_note && <p>{entry.decision_note}</p>}
              </>,
              ...(admin
                ? [
                    entry.status === 'pending' ? (
                      <DecisionAction
                        name={entry.applicant}
                        decide={async (decision, note) => {
                          await laravelWorkspace.review('applications', entry.id, decision, note);
                          reload();
                        }}
                      />
                    ) : (
                      'Reviewed'
                    ),
                  ]
                : []),
            ],
          }))}
        />
      )}
    </>
  );
}

function AffiliationForm({ reload }: { reload: () => void }) {
  const { records, error } = useWorkspaceRecords(localLaravelIdentity.choices);
  const choices = records?.filter((row) => row.kind !== 'high-school') ?? [];
  return (
    <WorkspaceAction
      action="Apply for incubation"
      submit="Submit application"
      save={async (data) => {
        await laravelWorkspace.apply({
          institution: fieldValue(data, 'institution'),
          location: fieldValue(data, 'location'),
          details: fieldValue(data, 'details'),
          consent: data.get('consent') === 'on',
        });
        reload();
      }}
    >
      <RecordsFeedback error={error} loading={records === null} />
      <label>
        University or hub
        <select name="institution" required defaultValue="">
          <option value="" disabled>
            {choices.length ? 'Choose an institution' : 'No active universities or hubs'}
          </option>
          {choices.map(({ slug, name }) => (
            <option key={slug} value={slug}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Why do you want to join?
        <textarea name="details" required minLength={10} maxLength={2000} />
      </label>
      <LocationConsent />
    </WorkspaceAction>
  );
}

function LocationConsent() {
  return (
    <>
      <label>
        Location
        <input name="location" required maxLength={120} />
      </label>
      <label className="inline-checkbox">
        <input type="checkbox" name="consent" required /> I agree to share this application with the
        institution and YERH.
      </label>
    </>
  );
}
