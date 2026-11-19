import { Link, useSearchParams } from 'react-router-dom';
import type { DemoAccount } from '../../domain/demo';
import type { PlatformState } from '../../domain/platform';
import { can } from '../../domain/roles';
import { MentorStages, ProductReviewQueue } from './TrainingReview';
import { field, type Save } from './TrainingForms';
import { WorkspaceFormDialog, WorkspaceTable, WorkspaceTabs } from './WorkspaceControls';
import { MilestoneEditor } from './WorkspaceEditors';

export function MentorWorkspace({
  p,
  account,
  save,
  name,
}: {
  p: PlatformState;
  account: DemoAccount;
  save: Save;
  name: (id: string) => string;
}) {
  const admin = can(account, 'admin');
  const paths = p.incubations.filter(
    (path) =>
      (path.mentorId === account.id || admin) &&
      !p.ventures.some((venture) => venture.id === path.ventureId && !!venture.groupId) &&
      (path.status === 'active' || path.status === 'completed'),
  );
  const [params] = useSearchParams();
  const base = '/dashboard/workspace?tab=mentees';
  const path = paths.find((entry) => entry.id === params.get('path'));
  if (path) {
    const title = p.ventures.find((entry) => entry.id === path.ventureId)?.name ?? 'Venture';
    const work = p.training.stages.filter((stage) => stage.incubationId === path.id);
    const editable = path.mentorId === account.id;
    return (
      <section className="workspace-record">
        <Link to={base}>← Assigned ventures</Link>
        <h3>{title}</h3>
        <p className="workspace-detail-copy">{path.goal}</p>
        {!work.length && <p>Stage evidence will appear here once it is saved.</p>}
        <MentorStages p={p} path={path} save={save} editable={editable} />

        {!path.milestones.length && <p>No milestones have been recorded.</p>}
        {path.milestones.map((milestone) => (
          <div className="training-step" key={milestone.id}>
            <p>
              <strong>{milestone.title}</strong>
            </p>
            <p className="workspace-detail-copy">{milestone.note}</p>
            {path.status === 'active' && (
              <MilestoneEditor incubationId={path.id} milestone={milestone} onSave={save} />
            )}
          </div>
        ))}
        {path.status === 'active' && (
          <WorkspaceFormDialog
            action="Add milestone"
            create
            submit="Save milestone"
            onSave={(data) =>
              save({
                type: 'milestone',
                id: path.id,
                milestoneId: crypto.randomUUID(),
                title: field(data, 'title'),
                note: field(data, 'note'),
                validated: data.get('validated') === 'on',
                now: new Date().toISOString(),
              })
            }
          >
            <label>
              Milestone title
              <input name="title" required minLength={3} />
            </label>
            <label>
              Guidance / progress notes
              <textarea name="note" required minLength={10} maxLength={3000} />
            </label>
            <label className="inline-checkbox">
              <input name="validated" type="checkbox" />
              Validate this milestone
            </label>
          </WorkspaceFormDialog>
        )}
      </section>
    );
  }
  return (
    <WorkspaceTabs
      label="Mentor work views"
      views={[
        {
          id: 'ventures',
          label: 'Assigned ventures',
          count: paths.length,
          content: (
            <WorkspaceTable
              label="assigned ventures"
              columns={['Venture', 'Owner', 'Needs attention', 'Actions']}
              empty="There are no assigned incubations yet."
              actions={<Link to="/dashboard/mentorship">Mentorship requests</Link>}
              rows={paths.map((path) => {
                const title =
                  p.ventures.find((venture) => venture.id === path.ventureId)?.name ?? 'Venture';
                const work = p.training.stages.filter((stage) => stage.incubationId === path.id);
                const reviews = work.filter(
                  (stage) => stage.reviewRequestedAt && !stage.examOpenedAt,
                ).length;
                const exams = work
                  .flatMap((stage) => stage.attempts)
                  .filter((attempt) => attempt.score === null).length;
                const feedback = work
                  .flatMap((stage) => stage.steps)
                  .filter((step) => step.requested).length;
                return {
                  id: path.id,
                  search: [title, name(path.ownerId)].join(' '),
                  cells: [
                    title,
                    name(path.ownerId),
                    [
                      reviews && `${reviews} stage review${reviews === 1 ? '' : 's'}`,
                      exams && `${exams} exam${exams === 1 ? '' : 's'} to grade`,
                      feedback && `${feedback} feedback request${feedback === 1 ? '' : 's'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—',
                    <div className="workspace-row-actions">
                      <Link to={base + '&path=' + encodeURIComponent(path.id)}>Review stages</Link>
                    </div>,
                  ],
                };
              })}
            />
          ),
        },
        {
          id: 'evidence',
          label: 'Product evidence reviews',
          count: p.training.productReviews.filter(
            (review) =>
              review.status === 'pending' &&
              (admin || paths.some((path) => path.id === review.incubationId)),
          ).length,
          content: (
            <ProductReviewQueue p={p} save={save} mentorId={admin ? undefined : account.id} />
          ),
        },
      ]}
    />
  );
}
