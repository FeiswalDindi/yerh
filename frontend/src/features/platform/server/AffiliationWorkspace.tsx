import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, FileUp, Sparkles } from 'lucide-react';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { laravelWorkspace } from '../../../services/laravel-workspace-repository';
import {
  localLaravelIdentity,
  type InstitutionChoice,
} from '../../../services/laravel-identity-repository';
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
  profileEmail,
  defaultLocation = '',
  onApproved,
}: {
  admin?: boolean;
  refresh?: () => Promise<void>;
  profileEmail?: string;
  defaultLocation?: string;
  onApproved?: () => Promise<void> | void;
}) {
  const { records, error, reload } = useWorkspaceRecords(laravelWorkspace.applications);
  const institutions = useWorkspaceRecords(localLaravelIdentity.choices, !admin);
  const choices = (institutions.records ?? []).filter((row) => row.kind !== 'high-school');
  const pending = records?.some((entry) => entry.status === 'pending');

  const emailDomain = profileEmail?.includes('@')
    ? profileEmail.trim().toLowerCase().split('@').pop() || ''
    : '';
  const matchedInstitution =
    !admin && !pending && emailDomain
      ? choices.find((row) => (row.allowed_domains ?? []).includes(emailDomain))
      : undefined;

  async function handleApplied(autoApproved?: boolean) {
    if (autoApproved) {
      await refresh?.();
      await onApproved?.();
      return;
    }
    reload();
  }

  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {matchedInstitution && (
        <div className="guest-instant-match" role="region" aria-label="Instant domain match">
          <div className="guest-instant-match__copy">
            <span className="guest-instant-match__badge">
              <Sparkles size={14} aria-hidden="true" />
              Instant match
            </span>
            <strong>{matchedInstitution.name}</strong>
            <p>
              Your verified <code>@{emailDomain}</code> email qualifies for automatic Entrepreneur
              access with {matchedInstitution.name}.
            </p>
          </div>
          <WorkspaceAction
            action={`Join ${matchedInstitution.name}`}
            title={`Join ${matchedInstitution.name}`}
            submit="Confirm & join now"
            save={async (data) => {
              const res = await laravelWorkspace.apply({
                institution: matchedInstitution.slug,
                location: fieldValue(data, 'location'),
                details: 'Instant institutional domain affiliation from profile hub.',
                consent: data.get('consent') === 'on',
              });
              await handleApplied(res.data?.auto_approved);
            }}
          >
            <p>
              Joining <strong>{matchedInstitution.name}</strong> immediately unlocks your
              Entrepreneur &amp; Incubation dashboard.
            </p>
            <LocationConsent defaultLocation={defaultLocation} />
          </WorkspaceAction>
        </div>
      )}
      {records && (
        <WorkspaceTable
          label="affiliation applications"
          columns={
            admin
              ? ['Applicant', 'Institution', 'Proof & location', 'Decision', 'Action']
              : ['Institution', 'Proof & location', 'Decision']
          }
          actions={
            !admin && (
              <div className="workspace-row-actions">
                {!pending && (
                  <AffiliationForm
                    choices={choices}
                    choicesLoading={institutions.records === null}
                    choicesError={institutions.error}
                    emailDomain={emailDomain}
                    defaultLocation={defaultLocation}
                    onApplied={handleApplied}
                  />
                )}
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
                    await onApproved?.();
                  }}
                >
                  <label>
                    Invitation code
                    <input name="token" required minLength={64} maxLength={64} autoComplete="off" />
                  </label>
                  <LocationConsent defaultLocation={defaultLocation} />
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
                {entry.has_document ? (
                  <ReceiptPreviewModal
                    url={laravelWorkspace.applicationDocumentUrl(entry.id)}
                    label={entry.document_name || 'View institutional proof'}
                    title={`Institutional proof — ${entry.institution}`}
                  />
                ) : (
                  <p>{entry.details}</p>
                )}
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
      {!admin && (
        <p className="guest-affiliation-footer">
          Representing a university, innovation hub, or high school?{' '}
          <Link to="/institutions/apply">Register your institution</Link>
        </p>
      )}
    </>
  );
}

function AffiliationForm({
  choices,
  choicesLoading,
  choicesError,
  emailDomain,
  defaultLocation,
  onApplied,
}: {
  choices: InstitutionChoice[];
  choicesLoading: boolean;
  choicesError: string;
  emailDomain: string;
  defaultLocation: string;
  onApplied: (autoApproved?: boolean) => Promise<void>;
}) {
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const activeChoice = choices.find((row) => row.slug === selectedSlug);
  const qualifiesInstant = Boolean(
    emailDomain && activeChoice?.allowed_domains?.includes(emailDomain),
  );

  const proofGuidance = activeChoice
    ? activeChoice.kind === 'hub'
      ? `Upload official proof from ${activeChoice.name} confirming your membership (e.g., member pass, cohort acceptance letter, or hub confirmation).`
      : `Upload official proof from ${activeChoice.name} confirming you are a student or member (e.g., Student ID, admission letter, or semester transcript).`
    : 'Upload official proof from the selected institution showing you are a student or member of their organisation.';

  return (
    <WorkspaceAction
      action="Apply for institution / hub"
      title="Verify your institution or hub membership"
      submit="Submit application"
      save={async (data) => {
        const form = new FormData();
        form.append('institution', fieldValue(data, 'institution'));
        form.append('location', fieldValue(data, 'location'));
        form.append('consent', data.get('consent') === 'on' ? '1' : '');
        const file = data.get('document');
        if (file instanceof File && file.size > 0) {
          form.append('document', file);
        }
        const res = await laravelWorkspace.apply(form);
        await onApplied(res.data?.auto_approved);
      }}
    >
      <RecordsFeedback error={choicesError} loading={choicesLoading} />
      <label>
        University or hub
        <select
          name="institution"
          required
          value={selectedSlug}
          onChange={(event) => setSelectedSlug(event.target.value)}
        >
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
      {qualifiesInstant && activeChoice ? (
        <p className="account-status" role="status">
          Your <code>@{emailDomain}</code> email matches {activeChoice.name}&apos;s verified domain
          — your membership will be approved immediately with no document required.
        </p>
      ) : (
        <div className="affiliation-upload-box">
          <div className="affiliation-upload-head">
            <strong>Institutional verification document</strong>
            <span className="affiliation-upload-badge">PDF, JPG, PNG, WebP · max 5 MB</span>
          </div>
          <p className="affiliation-upload-copy">{proofGuidance}</p>
          <label className="affiliation-upload-trigger">
            {selectedFile ? (
              <FileCheck2 size={18} aria-hidden="true" />
            ) : (
              <FileUp size={18} aria-hidden="true" />
            )}
            <span className="affiliation-upload-selected">
              {selectedFile
                ? `${selectedFile.name} (${Math.max(1, Math.round(selectedFile.size / 1024))} KB)`
                : 'Choose student ID, admission letter, or hub proof…'}
            </span>
            <input
              name="document"
              type="file"
              required={!qualifiesInstant}
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}
      <LocationConsent defaultLocation={defaultLocation} />
    </WorkspaceAction>
  );
}

function LocationConsent({ defaultLocation = '' }: { defaultLocation?: string }) {
  return (
    <>
      <label>
        Location (city or county)
        <input name="location" required maxLength={120} defaultValue={defaultLocation} />
      </label>
      <label className="inline-checkbox">
        <input type="checkbox" name="consent" required /> I agree to share this application with the
        institution and YERH.
      </label>
    </>
  );
}
