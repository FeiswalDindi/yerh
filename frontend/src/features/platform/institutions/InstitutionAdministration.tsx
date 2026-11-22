import { Link } from 'react-router-dom';
import type { DemoAccount } from '../../../domain/demo';
import type { Institution } from '../../../domain/incubation';
import type { PlatformState } from '../../../domain/platform';
import { can } from '../../../domain/roles';
import { workspaceHref } from '../../dashboard/dashboard-navigation';
import { accountInstitution } from '../../../domain/incubation';
import { field, TrainingForm, type Save } from '../incubation/TrainingForms';
import { WorkspaceDialog, WorkspaceTable } from '../workspace/WorkspaceControls';

export function InstitutionAdministratorField({
  staff,
  optional = false,
}: {
  staff: DemoAccount[];
  optional?: boolean;
}) {
  return (
    <label>
      Institution administrator
      <select name="admin" defaultValue="" required={!optional}>
        <option value="">{optional ? 'Assign later' : 'Choose an administrator'}</option>
        {staff.map((account) => (
          <option value={account.id} key={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InstitutionSettings({ school, save }: { school: Institution; save: Save }) {
  return (
    <TrainingForm
      save={save}
      label="Save intake details"
      dialog={{ action: 'Edit intake', title: school.name }}
      build={(data) => ({
        type: 'institution-intake',
        id: school.id,
        notes: field(data, 'notes'),
        visit: field(data, 'visit'),
        terms: field(data, 'terms'),
        amount: Number(field(data, 'amount')),
      })}
    >
      <label>
        Application details
        <textarea name="notes" maxLength={3000} defaultValue={school.intake?.notes} />
      </label>
      <label>
        Site visit date
        <input type="date" name="visit" defaultValue={school.intake?.visit} />
      </label>
      <label>
        Agreed terms
        <textarea name="terms" maxLength={3000} defaultValue={school.intake?.terms} />
      </label>
      <label>
        Agreed amount (KES)
        <input type="number" min={0} step={1} required name="amount" defaultValue={school.amount} />
      </label>
    </TrainingForm>
  );
}

export function InstitutionAccessEditor({
  p,
  school,
  accounts,
  save,
  person,
}: {
  p: PlatformState;
  school: Institution;
  accounts: DemoAccount[];
  save: Save;
  person?: DemoAccount;
}) {
  const candidates = accounts.filter((account) => {
    const affiliation = accountInstitution(p, account.id);
    return (
      (!affiliation || affiliation.id === school.id) &&
      !account.suspended &&
      ['guest', 'admin'].includes(account.role) &&
      !school.staffIds?.includes(account.id) &&
      !school.contactIds?.includes(account.id) &&
      account.id !== school.adminId
    );
  });
  if (!person && !candidates.length)
    return (
      <WorkspaceDialog action="Add staff or contact" create>
        {() => (
          <>
            <p>
              All eligible guest and platform administrator accounts already have access to this
              institution.
            </p>
            <Link to={workspaceHref('users')} aria-label="View users and roles">
              View
            </Link>
          </>
        )}
      </WorkspaceDialog>
    );
  return (
    <TrainingForm
      save={save}
      label="Save access"
      dialog={{
        action: person ? 'Edit access' : 'Add staff or contact',
        title: person?.name,
        create: !person,
      }}
      build={(data) => ({
        type: 'institution-access',
        id: school.id,
        accountId: person?.id ?? field(data, 'account'),
        access: field(data, 'access') as 'manage' | 'view' | 'none',
      })}
    >
      {!person && (
        <label>
          Account
          <select name="account" required>
            <option value="">Select an existing account</option>
            {candidates.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.email}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Access level
        <select
          name="access"
          defaultValue={person && school.staffIds?.includes(person.id) ? 'manage' : 'view'}
        >
          <option value="view">Contact · View results</option>
          <option value="manage">Staff · Manage institution workspace</option>
          {person && <option value="none">Remove access</option>}
        </select>
      </label>
    </TrainingForm>
  );
}

export function InstitutionActivity({
  p,
  school,
  accounts,
}: {
  p: PlatformState;
  school: Institution;
  accounts: DemoAccount[];
}) {
  return (
    <WorkspaceTable
      label="institution activity"
      exportName="yerh-institution-activity.csv"
      columns={['Date', 'Staff member', 'Action']}
      rows={p.audit
        .filter((entry) => entry.institutionId === school.id)
        .map((entry) => {
          const actor = accounts.find((account) => account.id === entry.actorId)?.name ?? 'Member';
          const action = entry.action.replaceAll('-', ' ');
          return {
            id: entry.id,
            search: [actor, action].join(' '),
            cells: [
              new Date(entry.createdAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
              actor,
              action,
            ],
          };
        })}
    />
  );
}

export function InstitutionActivation({
  school,
  administrator,
  availableStaff,
  save,
}: {
  school: Institution;
  administrator?: DemoAccount;
  availableStaff: DemoAccount[];
  save: Save;
}) {
  const needsAgreement = school.status === 'pending' && !school.proof;
  const needsAdministrator = !can(administrator, 'school');
  const canAssign = !school.adminId && availableStaff.length > 0;
  const agreementsHref =
    '?' +
    new URLSearchParams({
      tab: 'institutions',
      record: school.id,
      area: 'agreements',
    });
  const ready = !needsAgreement && !needsAdministrator;
  return (
    <section className="workspace-data workspace-data-toolbar institution-activation">
      <div>
        <h3>Portal activation</h3>
        {ready ? (
          <p>Ready to open the institution’s portal.</p>
        ) : (
          <>
            {school.status === 'pending' && (
              <p>
                {needsAgreement ? (
                  <>
                    Upload the signed PDF in{' '}
                    <Link className="text-link" to={agreementsHref} preventScrollReset>
                      Agreements
                    </Link>
                    .
                  </>
                ) : (
                  'Signed agreement uploaded.'
                )}
              </p>
            )}
            {needsAdministrator && (
              <p>
                {school.adminId ? (
                  <>
                    Restore the primary administrator’s access in{' '}
                    <Link className="text-link" to={workspaceHref('users')}>
                      Users &amp; roles
                    </Link>
                    .
                  </>
                ) : canAssign ? (
                  'Assign a primary administrator to open the portal.'
                ) : (
                  <>
                    Give an unassigned account the <strong>Institutional Administrator</strong> role
                    in{' '}
                    <Link className="text-link" to={workspaceHref('users')}>
                      Users &amp; roles
                    </Link>
                    , then return here to assign that account.
                  </>
                )}
              </p>
            )}
          </>
        )}
      </div>
      {canAssign && (
        <TrainingForm
          save={save}
          label="Save administrator"
          dialog={{ action: 'Assign administrator' }}
          build={(data) => ({
            type: 'institution-assign-admin',
            id: school.id,
            adminId: field(data, 'admin'),
          })}
        >
          <InstitutionAdministratorField staff={availableStaff} />
        </TrainingForm>
      )}
      {ready && (
        <TrainingForm
          save={save}
          label="Activate institution"
          dialog={{ action: 'Activate institution' }}
          build={() => ({ type: 'institution-activate', id: school.id })}
        >
          <p>This opens the institution’s portal for its assigned staff.</p>
        </TrainingForm>
      )}
    </section>
  );
}
