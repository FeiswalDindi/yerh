import { canPublishProduct } from '../../../domain/incubation';
import { amount, field } from '../incubation/TrainingForms';
import {
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
} from '../workspace/WorkspaceControls';

import { now } from '../workspace/WorkspacePanel';
import type { PlatformState } from '../../../domain/platform';
import type { Save } from '../incubation/TrainingForms';

export function AdminProducts({
  p,
  name,
  run,
}: {
  p: PlatformState;
  name: (id: string) => string;
  run: Save;
}) {
  const rows = p.products.filter((product) =>
    p.ventures.some((venture) => venture.id === product.ventureId && !venture.groupId),
  );
  return (
    <WorkspaceTable
      label="marketplace products"
      columns={['Name', 'Owner', 'Status', 'Marketplace', 'Action']}
      rows={rows.map((row) => {
        const owner = name(row.ownerId);
        return {
          id: row.id,
          search: [
            row.name,
            owner,
            row.status,
            p.ventures.find((venture) => venture.id === row.ventureId)?.name,
          ].join(' '),
          cells: [
            row.name,
            owner,
            <WorkspaceStatus>{row.status}</WorkspaceStatus>,
            canPublishProduct(p, row) ? 'Live' : 'Private',
            <WorkspaceFormDialog
              action="Review record"
              title={row.name}
              submit="Save status"
              onSave={(data) =>
                run({
                  type: 'venture-review',
                  id: row.id,
                  entity: 'product',
                  decision: field(data, 'status') as typeof row.status,
                  now: now(),
                })
              }
            >
              <p className="workspace-detail-copy">{row.description}</p>
              {'price' in row && (
                <p>
                  {p.ventures.find((venture) => venture.id === row.ventureId)?.name} ·{' '}
                  {amount(row.price)}
                </p>
              )}
              <label>
                Status
                <select name="status" defaultValue={row.status}>
                  <option value="pending">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </WorkspaceFormDialog>,
          ],
        };
      })}
    />
  );
}
