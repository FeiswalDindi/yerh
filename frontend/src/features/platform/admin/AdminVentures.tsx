import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cohortForVenture, schoolForVenture } from '../../../domain/incubation';
import type { PlatformState, Venture } from '../../../domain/platform';
import { workspaceHref } from '../../dashboard/dashboard-navigation';
import { field, type Save } from '../incubation/TrainingForms';
import {
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTabs,
} from '../workspace/WorkspaceControls';

export function AdminVentures({
  p,
  save,
  name,
}: {
  p: PlatformState;
  save: Save;
  name: (id: string) => string;
}) {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('');
  const [institution, setInstitution] = useState('');
  const scoped = p.ventures.map((venture) => ({
    venture,
    school: schoolForVenture(p, venture),
    cohort: cohortForVenture(p, venture),
  }));
  const projects = scoped.filter((row) => !!row.venture.groupId);
  const founders = scoped.filter((row) => !row.venture.groupId);
  const selected = scoped.find((row) => row.venture.id === params.get('record'));
  function detailsHref(id?: string) {
    const next = new URLSearchParams(params);
    if (id) next.set('record', id);
    else next.delete('record');
    return '?' + next.toString();
  }
  const review = (venture: Venture) => (
    <WorkspaceFormDialog
      action="Review record"
      title={venture.name}
      submit="Save status"
      onSave={(data) =>
        save({
          type: 'venture-review',
          id: venture.id,
          entity: 'venture',
          decision: field(data, 'status') as Venture['status'],
          now: new Date().toISOString(),
        })
      }
    >
      <p className="workspace-detail-copy">{venture.description}</p>
      <label>
        Status
        <select name="status" defaultValue={venture.status}>
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
    </WorkspaceFormDialog>
  );
  if (selected) {
    const { venture, school, cohort } = selected;
    return (
      <section className="workspace-record">
        <Link to={detailsHref()}>← Manage ventures</Link>
        <h2>{venture.name}</h2>
        <p className="workspace-detail-copy">{venture.description}</p>
        <dl className="workspace-profile">
          <div>
            <dt>{school ? 'Institution' : 'Founder'}</dt>
            <dd>
              {school ? (
                <Link
                  to={workspaceHref('institutions') + '&record=' + encodeURIComponent(school.id)}
                >
                  {school.name}
                </Link>
              ) : (
                name(venture.ownerId)
              )}
            </dd>
          </div>
          {school && (
            <div>
              <dt>Cohort</dt>
              <dd>{cohort?.name ?? '—'}</dd>
            </div>
          )}
          <div>
            <dt>Sector</dt>
            <dd>{venture.sector}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{venture.stage}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{venture.location}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <WorkspaceStatus>{venture.status}</WorkspaceStatus>
            </dd>
          </div>
        </dl>
        {!venture.groupId && review(venture)}
      </section>
    );
  }
  function directory(rows: typeof scoped, schools = false) {
    return (
      <WorkspaceTable
        label={schools ? 'institution ventures' : 'individual ventures'}
        exportName={schools ? 'yerh-institution-ventures.csv' : 'yerh-individual-ventures.csv'}
        columns={[
          'Venture',
          schools ? 'Institution' : 'Founder',
          ...(schools ? ['Cohort'] : []),
          'Sector',
          'Status',
          'Actions',
        ]}
        actions={
          <>
            {schools && (
              <label className="workspace-toolbar-filter">
                Institution
                <select
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                >
                  <option value="">All institutions</option>
                  {p.training.institutions
                    .filter((school) => rows.some((row) => row.school?.id === school.id))
                    .map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="workspace-toolbar-filter">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </>
        }
        rows={rows
          .filter(
            ({ venture, school }) =>
              (!status || venture.status === status) &&
              (!schools || !institution || school?.id === institution),
          )
          .map(({ venture, school, cohort }) => {
            const values = [
              venture.name,
              school?.name ?? name(venture.ownerId),
              ...(schools ? [cohort?.name ?? '—'] : []),
              venture.sector,
            ];
            return {
              id: venture.id,
              search: [...values, venture.stage, venture.location, venture.status].join(' '),
              csv: [...values, venture.status],
              cells: [
                ...values,
                <WorkspaceStatus>{venture.status}</WorkspaceStatus>,
                <div className="workspace-row-actions">
                  <Link to={detailsHref(venture.id)} aria-label="View venture">
                    View
                  </Link>
                  {!schools && review(venture)}
                </div>,
              ],
            };
          })}
      />
    );
  }
  return (
    <WorkspaceTabs
      label="Venture ownership views"
      views={[
        {
          id: 'individuals',
          label: 'Individual ventures',
          count: founders.length,
          content: directory(founders),
        },
        {
          id: 'institutions',
          label: 'Institution ventures',
          count: projects.length,
          content: directory(projects, true),
        },
      ]}
    />
  );
}
