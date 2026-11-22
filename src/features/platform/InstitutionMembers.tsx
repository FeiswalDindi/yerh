import { Link, useSearchParams } from 'react-router-dom';
import type { DemoAccount } from '../../domain/demo';
import type { Institution } from '../../domain/incubation';
import type { PlatformState } from '../../domain/platform';
import {
  institutionInvitationLimit,
  institutionProgrammeMembers,
} from '../../domain/institution-members';
import { programmeHref } from './InstitutionProgramme';
import { field, type Save } from './TrainingForms';
import { WorkspaceFormDialog, WorkspaceTable } from './WorkspaceControls';

function invitationEntries(list: string) {
  return list
    .split(/\r\n?|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = Math.max(line.lastIndexOf('\t'), line.lastIndexOf(','));
      return {
        id: crypto.randomUUID(),
        name: separator < 0 ? line : line.slice(0, separator),
        email: separator < 0 ? '' : line.slice(separator + 1),
      };
    });
}

export function InstitutionMembers({
  p,
  institution,
  accounts,
  save,
  tabParameter = 'view',
}: {
  p: PlatformState;
  institution: Institution;
  accounts: DemoAccount[];
  save: Save;
  tabParameter?: 'view' | 'area';
}) {
  const [params] = useSearchParams();
  const invitations = (p.institutionInvitations ?? []).filter(
    (row) => row.institutionId === institution.id,
  );
  const members = institutionProgrammeMembers(p, accounts, institution.id);
  const active = institution.status === 'active';
  return (
    <>
      <WorkspaceTable
        label="members"
        columns={['Name', 'Email', 'Access', 'Action']}
        empty="Members appear here after they accept an invitation or YERH approves their application."
        actions={
          active && (
            <>
              <WorkspaceFormDialog
                submit="Create invitation"
                action="Invite member"
                create
                onSave={(data) =>
                  save({
                    type: 'institution-invite',
                    id: crypto.randomUUID(),
                    institutionId: institution.id,
                    name: field(data, 'name'),
                    email: field(data, 'email'),
                    now: new Date().toISOString(),
                  })
                }
              >
                <p>Use the member’s existing account email if they already use YERH.</p>
                <label>
                  Full name <input name="name" required minLength={2} maxLength={80} />
                </label>
                <label>
                  Email <input type="email" name="email" required maxLength={254} />
                </label>
              </WorkspaceFormDialog>
              <WorkspaceFormDialog
                action="Invite members"
                submit="Create invitations"
                onSave={(data) =>
                  save({
                    type: 'institution-invite-bulk',
                    institutionId: institution.id,
                    entries: invitationEntries(field(data, 'members')),
                    now: new Date().toISOString(),
                  })
                }
              >
                <p>
                  Paste up to {institutionInvitationLimit} members, one per line. Use a name and
                  email separated by a comma or paste two columns without the headings.
                </p>
                <label>
                  Names and emails
                  <textarea
                    name="members"
                    rows={7}
                    maxLength={35000}
                    required
                    placeholder="Amina Demo, amina@example.test"
                  />
                </label>
                <p>Each invitation gets its own link in the invitations list.</p>
              </WorkspaceFormDialog>
            </>
          )
        }
        rows={members.map((row) => ({
          id: row.id,
          search: `${row.name} ${row.email}`,
          cells: [
            row.name,
            row.email,
            'Youth entrepreneur',
            active && (
              <Link to={programmeHref(params, tabParameter, 'progress', row.id)}>View</Link>
            ),
          ],
        }))}
      />
      <h3>Invitations</h3>
      <WorkspaceTable
        label="member invitations"
        columns={['Name', 'Email', 'Invitation', 'Action']}
        empty="No members invited yet."
        rows={[...invitations].reverse().map((row) => ({
          id: row.id,
          search: `${row.name} ${row.email}`,
          cells: [
            row.name,
            row.email,
            { pending: 'Awaiting acceptance', accepted: 'Accepted', revoked: 'Revoked' }[
              row.status
            ],
            row.status === 'pending' && active ? (
              <div className="workspace-row-actions">
                <Link to={`/account/invitations/${encodeURIComponent(row.id)}`}>
                  Open invitation link
                </Link>
                <WorkspaceFormDialog
                  submit="Revoke invitation"
                  action="Revoke"
                  title={row.name}
                  onSave={() =>
                    save({
                      type: 'institution-invite-revoke',
                      institutionId: institution.id,
                      id: row.id,
                      now: new Date().toISOString(),
                    })
                  }
                >
                  <p>Revoke the unused invitation for {row.email}.</p>
                </WorkspaceFormDialog>
              </div>
            ) : (
              '—'
            ),
          ],
        }))}
      />
    </>
  );
}
