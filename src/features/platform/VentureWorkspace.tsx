import { Link, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { DemoAccount } from '../../domain/demo';
import { cohortForVenture, managesVenture, type TrainingState } from '../../domain/incubation';
import type { PlatformState, Venture } from '../../domain/platform';
import { can } from '../../domain/roles';
import { ventureResultsHref, workspaceHref } from '../dashboard/dashboard-navigation';
import { field, type Save } from './TrainingForms';
import { WorkspaceFormDialog, WorkspaceTable } from './WorkspaceControls';

export type VentureWorkspaceProps = {
  p: PlatformState;
  account: DemoAccount;
  save: Save;
  portalHref?: (tab: string) => string;
};

export default function VentureRegistry({
  p,
  account,
  save,
  portalHref = workspaceHref,
}: VentureWorkspaceProps) {
  const ventures = p.ventures.filter((venture) => managesVenture(p, account, venture));
  const school = p.training.institutions.find((entry) => entry.adminId === account.id);
  const cohorts = (p.training.cohorts ?? []).filter(
    (cohort) => cohort.institutionId === school?.id,
  );
  const teams = p.training.groups.filter((group) => group.institutionId === school?.id);
  const needsTeam = can(account, 'school') && !teams.length;
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') ?? '';
  const visible = !filter
    ? ventures
    : ventures.filter((venture) => (cohortForVenture(p, venture)?.id ?? 'unassigned') === filter);
  return (
    <WorkspaceTable
      label="ventures"
      columns={['Venture', ...(school ? ['Cohort'] : []), 'Sector', 'Stage', 'Location', 'Action']}
      empty={
        needsTeam ? (
          <>
            Create a team in the{' '}
            <Link to={portalHref('school') + '&view=teams'}>institution portal</Link> to add its
            first venture.
          </>
        ) : (
          'Add your first venture to start incubation or submit a product.'
        )
      }
      actions={
        <>
          {school && (
            <label className="workspace-toolbar-filter">
              Cohort
              <select
                value={filter}
                onChange={(event) =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    if (event.target.value) next.set('filter', event.target.value);
                    else next.delete('filter');
                    return next;
                  })
                }
              >
                <option value="">All cohorts</option>
                <option value="unassigned">No cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!needsTeam && (
            <VentureEditor account={account} teams={teams} cohorts={cohorts} save={save} />
          )}
        </>
      }
      rows={visible.map((venture) => {
        const cohort = cohortForVenture(p, venture);
        return {
          id: venture.id,
          search: [
            venture.name,
            venture.sector,
            venture.stage,
            venture.location,
            cohort?.name,
          ].join(' '),
          cells: [
            <>
              {venture.name}
              {venture.status === 'approved' && (
                <span
                  className="venture-approved"
                  title="Approved"
                  role="img"
                  aria-label="Approved"
                >
                  <Check size={16} aria-hidden="true" />
                </span>
              )}
            </>,
            ...(school ? [cohort?.name ?? '—'] : []),
            venture.sector,
            venture.stage,
            venture.location,
            <div className="workspace-row-actions">
              <VentureEditor
                venture={venture}
                account={account}
                teams={teams}
                cohorts={cohorts}
                save={save}
              />
              {school && cohorts.length > 0 && (
                <WorkspaceFormDialog
                  action="Assign cohort"
                  title={venture.name}
                  submit="Save cohort"
                  onSave={(data) =>
                    save({
                      type: 'venture-cohort',
                      id: venture.id,
                      cohortId: field(data, 'cohort'),
                      now: new Date().toISOString(),
                    })
                  }
                >
                  <CohortSelect cohorts={cohorts} selected={cohort?.id} />
                </WorkspaceFormDialog>
              )}
              {school &&
                p.incubations.some(
                  (path) =>
                    path.ventureId === venture.id &&
                    ['active', 'completed', 'pending'].includes(path.status),
                ) && (
                  <Link
                    to={ventureResultsHref(portalHref('member-results'), venture.id, cohort?.id)}
                  >
                    Record marks
                  </Link>
                )}
            </div>,
          ],
        };
      })}
    />
  );
}

function CohortSelect({
  cohorts,
  selected,
}: {
  cohorts: NonNullable<TrainingState['cohorts']>;
  selected?: string;
}) {
  return (
    <label>
      Cohort
      <select name="cohort" defaultValue={selected ?? ''}>
        <option value="">No cohort</option>
        {cohorts.map((cohort) => (
          <option key={cohort.id} value={cohort.id}>
            {cohort.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function VentureEditor({
  venture,
  teams,
  cohorts,
  account,
  save,
}: {
  venture?: Venture;
  teams: TrainingState['groups'];
  cohorts: NonNullable<TrainingState['cohorts']>;
  account: DemoAccount;
  save: Save;
}) {
  return (
    <WorkspaceFormDialog
      action={venture ? 'Edit venture' : 'Add venture'}
      title={venture ? venture.name : 'Add venture'}
      create={!venture}
      submit={
        account.role === 'school_admin'
          ? 'Save venture'
          : venture
            ? 'Resubmit venture'
            : 'Submit venture for approval'
      }
      onSave={(data) =>
        save({
          type: 'venture-save',
          now: new Date().toISOString(),
          venture: {
            id: venture?.id ?? crypto.randomUUID(),
            ownerId: account.id,
            groupId: venture?.groupId ?? (field(data, 'group') || undefined),
            cohortId: venture?.cohortId ?? (field(data, 'cohort') || undefined),
            name: field(data, 'name'),
            description: field(data, 'description'),
            sector: field(data, 'sector'),
            stage: field(data, 'stage'),
            location: field(data, 'location'),
            status: venture?.status ?? 'pending',
          },
        })
      }
    >
      {venture && account.role !== 'school_admin' && <p>Changes require a new approval.</p>}
      {!venture && teams.length > 0 && (
        <label>
          Venture team
          <select name="group" required>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!venture && cohorts.length > 0 && <CohortSelect cohorts={cohorts} />}
      <label>
        Venture name
        <input name="name" required minLength={3} defaultValue={venture?.name} />
      </label>
      <label>
        What problem do you solve?
        <textarea
          name="description"
          required
          minLength={30}
          maxLength={3000}
          defaultValue={venture?.description}
        />
      </label>
      <div className="form-field-grid">
        <label>
          Sector
          <input name="sector" required minLength={2} defaultValue={venture?.sector} />
        </label>
        <label>
          Stage
          <input name="stage" required minLength={2} defaultValue={venture?.stage} />
        </label>
        <label>
          Location
          <input name="location" required minLength={2} defaultValue={venture?.location} />
        </label>
      </div>
    </WorkspaceFormDialog>
  );
}
