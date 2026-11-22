import { roleLabels, type Role } from '../../../domain/roles';
import {
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
} from '../workspace/WorkspaceControls';

import { Panel, now } from '../workspace/WorkspacePanel';
import type { DemoAccount, DemoState } from '../../../domain/demo';
import type { Save } from '../incubation/TrainingForms';

export function UserAccessDirectory({
  state,
  account,
  run,
}: {
  state: DemoState;
  account: DemoAccount;
  run: Save;
}) {
  return (
    <>
      <Panel title="Users & access">
        <WorkspaceTable
          label="members"
          columns={['Member', 'Email', 'Role', 'Status', 'Action']}
          rows={state.accounts.map((member) => {
            const status = member.suspended ? 'Suspended' : 'Active';
            return {
              id: member.id,
              search: [member.name, member.email, roleLabels[member.role], status].join(' '),
              cells: [
                member.name,
                member.email,
                roleLabels[member.role],
                <WorkspaceStatus>{status}</WorkspaceStatus>,
                member.id === account.id ? (
                  'Your account'
                ) : (
                  <WorkspaceFormDialog
                    action="Manage access"
                    title={member.name}
                    submit="Save access"
                    onSave={(data) =>
                      run({
                        type: 'account-admin',
                        accountId: member.id,
                        role: String(data.get('role')) as Role,
                        suspended: data.get('suspended') === 'on',
                        now: now(),
                      })
                    }
                  >
                    <label>
                      Role
                      <select name="role" defaultValue={member.role}>
                        {Object.entries(roleLabels)
                          .filter(
                            ([id]) =>
                              (id !== 'entrepreneur' || member.role === 'entrepreneur') &&
                              (id !== 'school_admin' ||
                                member.role === 'guest' ||
                                member.role === 'school_admin'),
                          )
                          .map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="inline-checkbox">
                      <input type="checkbox" name="suspended" defaultChecked={member.suspended} />
                      Suspend account
                    </label>
                  </WorkspaceFormDialog>
                ),
              ],
            };
          })}
        />
      </Panel>{' '}
    </>
  );
}
