import { downloadCsv } from '../../../shared/downloadCsv';

import { Panel } from '../workspace/WorkspacePanel';
import type { DemoState } from '../../../domain/demo';

export function AuditReports({ state, name }: { state: DemoState; name: (id: string) => string }) {
  const p = state.platform;

  return (
    <>
      <Panel title="Analytics, reporting & audit">
        <div className="workspace-stats">
          {[
            ['Accounts', state.accounts.length],
            ['Pending roles', p.applications.filter((a) => a.status === 'pending').length],
            ['Approved ventures', p.ventures.filter((v) => v.status === 'approved').length],
            ['Reservations', state.registrations.filter((r) => r.status === 'registered').length],
          ].map(([label, value]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p>Counts are derived from current local records.</p>
        <button
          className="button button-outline"
          onClick={() => {
            const rows = [
              ['Actor', 'Action', 'Target', 'Time'],
              ...p.audit.map((a) => [name(a.actorId), a.action, a.targetId, a.createdAt]),
            ];
            downloadCsv('yerh-audit.csv', rows);
          }}
        >
          Export audit CSV
        </button>
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {p.audit.slice(0, 100).map((a) => (
                <tr key={a.id}>
                  <td>{name(a.actorId)}</td>
                  <td>{a.action}</td>
                  <td>{a.targetId}</td>
                  <td>{new Date(a.createdAt).toLocaleString('en-KE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>{' '}
    </>
  );
}
