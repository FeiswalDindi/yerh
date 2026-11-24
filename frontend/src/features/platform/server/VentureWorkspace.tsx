import { SectorSelect } from './MarketplaceSectors';
import { WorkspaceTable } from '../workspace/WorkspaceControls';
import { StatusIndicator } from '../../../shared/StatusIndicator';
import { laravelWorkspace, type Venture } from '../../../services/laravel-workspace-repository';
import {
  DecisionAction,
  fieldValue,
  RecordsFeedback,
  useWorkspaceRecords,
  WorkspaceAction,
} from './WorkspaceActions';

export function VentureWorkspace({ admin }: { admin: boolean }) {
  const { records, error, reload } = useWorkspaceRecords(laravelWorkspace.ventures);
  return (
    <>
      <RecordsFeedback error={error} loading={records === null} />
      {records && (
        <WorkspaceTable
          label="ventures"
          columns={['Venture', 'Institution', 'Review', 'Action']}
          actions={!admin && <VentureForm reload={reload} />}
          rows={records.map((venture) => ({
            id: String(venture.id),
            search: [
              venture.name,
              venture.institution,
              venture.owner,
              venture.sector,
              venture.status,
            ].join(' '),
            cells: [
              <>
                <strong>{venture.name}</strong>
                <p>
                  {venture.sector} · {venture.location}
                </p>
                <p>{venture.description}</p>
              </>,
              <>
                {venture.institution}
                {admin && <p>{venture.owner}</p>}
              </>,
              <>
                <StatusIndicator status={venture.status} />
                {venture.decision_note && <p>{venture.decision_note}</p>}
              </>,
              admin && venture.status === 'pending' ? (
                <DecisionAction
                  name={venture.name}
                  decide={async (decision, note) => {
                    await laravelWorkspace.review('ventures', venture.id, decision, note);
                    reload();
                  }}
                />
              ) : !admin && venture.status === 'rejected' ? (
                <VentureForm venture={venture} reload={reload} />
              ) : (
                '—'
              ),
            ],
          }))}
        />
      )}
    </>
  );
}

function VentureForm({ venture, reload }: { venture?: Venture; reload: () => void }) {
  return (
    <WorkspaceAction
      action={venture ? 'Edit venture' : 'Add venture'}
      title={venture?.name}
      create={!venture}
      submit="Submit for review"
      save={async (data) => {
        await laravelWorkspace.saveVenture(
          {
            name: fieldValue(data, 'name'),
            sector: fieldValue(data, 'sector'),
            location: fieldValue(data, 'location'),
            description: fieldValue(data, 'description'),
          },
          venture?.id,
        );
        reload();
      }}
    >
      <label>
        Name
        <input name="name" required minLength={2} maxLength={120} defaultValue={venture?.name} />
      </label>
      <label>
        Sector
        <SectorSelect value={venture?.sector} />
      </label>
      <label>
        Location
        <input name="location" required maxLength={120} defaultValue={venture?.location} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={2000}
          defaultValue={venture?.description}
        />
      </label>
    </WorkspaceAction>
  );
}
