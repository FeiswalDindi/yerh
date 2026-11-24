import { useState } from 'react';
import { Mail } from 'lucide-react';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import {
  laravelWorkspace,
  type ContactMessage,
} from '../../../services/laravel-workspace-repository';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import {
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

export function EnquiriesInbox() {
  const { records, error, reload } = useWorkspaceRecords(laravelWorkspace.contactMessages);
  const [statusFilter, setStatusFilter] = useState<'all' | ContactMessage['status']>('all');

  const visible = records?.filter((row) => statusFilter === 'all' || row.status === statusFilter);

  return (
    <>
      <RecordsFeedback loading={!records} error={error} />
      {visible && (
        <WorkspaceTable
          label="enquiries"
          columns={['Sender', 'Topic', 'Message', 'Status', 'Handled by', 'Action']}
          empty={
            statusFilter === 'all'
              ? 'No enquiries have been received yet.'
              : `No ${statusFilter} enquiries.`
          }
          actions={
            <label className="workspace-status-filter">
              <span className="sr-only">Filter enquiries by status</span>
              <select
                aria-label="Filter enquiries by status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | ContactMessage['status'])
                }
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="read">Read</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
          }
          rows={visible.map((row) => ({
            id: String(row.id),
            search: [row.name, row.email, row.topic, row.message, row.status].join(' '),
            cells: [
              <>
                <strong>{row.name}</strong>
                <div>
                  <a href={`mailto:${row.email}`}>{row.email}</a>
                </div>
              </>,
              row.topic,
              <>
                <p>{row.message}</p>
                {row.admin_notes && <p>Internal note: {row.admin_notes}</p>}
              </>,
              <StatusIndicator status={row.status} />,
              row.handler_name
                ? `${row.handler_name}${row.handled_at ? ' · ' + new Date(row.handled_at.replace(' ', 'T') + 'Z').toLocaleDateString() : ''}`
                : '—',
              <div className="workspace-row-actions">
                <a href={`mailto:${row.email}?subject=${encodeURIComponent('Re: ' + row.topic)}`}>
                  <Mail size={14} aria-hidden="true" /> Reply
                </a>
                <WorkspaceAction
                  action="Update status"
                  title={`${row.topic} · ${row.name}`}
                  submit="Save enquiry"
                  save={async (data) => {
                    await laravelWorkspace.updateContactMessage(
                      row.id,
                      fieldValue(data, 'status') as ContactMessage['status'],
                      fieldValue(data, 'admin_notes'),
                    );
                    reload();
                  }}
                >
                  <label>
                    Status
                    <select name="status" defaultValue={row.status}>
                      <option value="new">New</option>
                      <option value="read">Read</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                  <label>
                    Internal notes (optional)
                    <textarea
                      name="admin_notes"
                      defaultValue={row.admin_notes ?? ''}
                      maxLength={2000}
                      rows={3}
                    />
                  </label>
                </WorkspaceAction>
              </div>,
            ],
          }))}
        />
      )}
    </>
  );
}
