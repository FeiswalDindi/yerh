import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Course } from '../../../domain/hub';
import type { PlatformState } from '../../../domain/platform';
import {
  authoredCourseId,
  coursePricing,
  validCourseDocuments,
  type CourseCommand,
  type Proposal,
} from '../../../domain/courses';
import { amount, field, type Save } from '../incubation/TrainingForms';
import {
  WorkspaceDialog,
  WorkspaceFormDialog,
  WorkspaceStatus,
  WorkspaceTable,
  WorkspaceTabs,
} from '../workspace/WorkspaceControls';

const now = () => new Date().toISOString();

function ProposalForm({ save, finish }: { save: Save; finish: (ok: boolean) => void }) {
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const files = data
      .getAll('proposal')
      .filter((file): file is File => file instanceof File && file.size > 0);
    setError('');
    if (
      !files.length ||
      files.some((file) => file.type !== 'application/pdf') ||
      files.reduce((size, file) => size + file.size, 0) > 256000
    ) {
      setError('Choose PDF files up to 250 KB combined.');
      return;
    }
    setReading(true);
    try {
      const documents = await Promise.all(
        files.map(
          (file) =>
            new Promise<Proposal['documents'][number]>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(reader.error);
              reader.onload = () => resolve({ name: file.name, data: String(reader.result) });
              reader.readAsDataURL(file);
            }),
        ),
      );
      if (!validCourseDocuments(documents)) {
        setError('Choose valid PDF files.');
        return;
      }
      finish(
        save({
          type: 'course-propose',
          id: crypto.randomUUID(),
          title: field(data, 'title'),
          description: field(data, 'description'),
          audience: field(data, 'audience'),
          documents,
          now: now(),
        }),
      );
    } catch {
      setError('A supporting document could not be read.');
    } finally {
      setReading(false);
    }
  }
  return (
    <form className="workspace-form" onSubmit={submit}>
      <label>
        Course title
        <input name="title" required minLength={3} maxLength={120} />
      </label>
      <label>
        Intended learners
        <input name="audience" required minLength={3} maxLength={300} />
      </label>
      <label>
        Course outline and outcomes
        <textarea name="description" required minLength={20} maxLength={3000} />
      </label>
      <label>
        Supporting documents (PDF)
        <input name="proposal" type="file" accept="application/pdf,.pdf" multiple required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="button" disabled={reading}>
        Submit proposal
      </button>
    </form>
  );
}

function ProposalDetails({ proposal }: { proposal: Proposal }) {
  return (
    <>
      <p>
        <strong>Intended learners</strong> · {proposal.audience}
      </p>
      <p className="workspace-detail-copy">{proposal.description}</p>
      <ul aria-label="Supporting documents">
        {proposal.documents.map((document, index) => (
          <li key={index}>
            <a href={document.data} download={document.name}>
              {document.name}
            </a>
          </li>
        ))}
      </ul>
      {proposal.feedback && (
        <p>
          <strong>Administrator feedback</strong> · {proposal.feedback}
        </p>
      )}
    </>
  );
}

function ModuleEditor({
  proposal,
  module,
  save,
}: {
  proposal: Proposal;
  module?: Proposal['modules'][number];
  save: Save;
}) {
  return (
    <WorkspaceFormDialog
      action={module ? 'Edit module' : 'Add module'}
      title={module?.title}
      create={!module}
      submit="Save module"
      onSave={(data) =>
        save({
          type: 'course-module-save',
          id: proposal.id,
          moduleId: module?.id ?? crypto.randomUUID(),
          title: field(data, 'title'),
          body: field(data, 'body'),
          now: now(),
        })
      }
    >
      <label>
        Module title
        <input name="title" required minLength={3} maxLength={120} defaultValue={module?.title} />
      </label>
      <label>
        Lesson material
        <textarea
          name="body"
          required
          minLength={20}
          maxLength={5000}
          defaultValue={module?.body}
        />
      </label>
    </WorkspaceFormDialog>
  );
}

export function MentorCourseWorkspace({
  p,
  mentorId,
  save,
}: {
  p: PlatformState;
  mentorId: string;
  save: Save;
}) {
  const proposals = (p.courseCommerce?.proposals ?? []).filter((row) => row.mentorId === mentorId);
  const [params] = useSearchParams();
  const base = '/dashboard/workspace?tab=course-proposals';
  const proposal = proposals.find((entry) => entry.id === params.get('proposal'));
  if (proposal) {
    return (
      <section className="workspace-record">
        <Link to={base}>← Course proposals</Link>
        <h3>{proposal.title}</h3>
        <ProposalDetails proposal={proposal} />
        {proposal.status === 'approved' && (
          <>
            <WorkspaceTable
              label="course modules"
              columns={['Module', 'Action']}
              actions={<ModuleEditor proposal={proposal} save={save} />}
              rows={proposal.modules.map((module) => ({
                id: module.id,
                search: module.title,
                cells: [
                  module.title,
                  <ModuleEditor proposal={proposal} module={module} save={save} />,
                ],
              }))}
            />
            {proposal.modules.length > 0 && (
              <WorkspaceFormDialog
                action="Publish course"
                submit="Publish paid course"
                onSave={(data) =>
                  save({
                    type: 'course-publish',
                    id: proposal.id,
                    price: Number(field(data, 'price')),
                    now: now(),
                  })
                }
              >
                <label>
                  Price (KES)
                  <input required type="number" name="price" min={1} max={1000000} step={1} />
                </label>
              </WorkspaceFormDialog>
            )}
          </>
        )}
      </section>
    );
  }
  return (
    <WorkspaceTable
      label="course proposals"
      columns={['Course', 'Royalty rate', 'Paid enrollments', 'Royalties', 'Actions']}
      actions={
        <WorkspaceDialog action="Propose a course" create>
          {(finish) => <ProposalForm save={save} finish={finish} />}
        </WorkspaceDialog>
      }
      empty="You have not submitted a course proposal."
      rows={proposals.map((proposal) => {
        const id = authoredCourseId(proposal);
        const purchases = p.courseCommerce?.purchases.filter((row) => row.courseId === id) ?? [];
        return {
          id: proposal.id,
          search: [proposal.title, proposal.audience].join(' '),
          cells: [
            proposal.title,
            proposal.status === 'approved' || proposal.status === 'published'
              ? proposal.royaltyPercent + '%'
              : '—',
            purchases.length,
            amount(purchases.reduce((sum, row) => sum + row.royaltyCents, 0) / 100),
            <div className="workspace-row-actions">
              <Link
                to={base + '&proposal=' + encodeURIComponent(proposal.id)}
                aria-label={proposal.status === 'approved' ? undefined : 'View proposal'}
              >
                {proposal.status === 'approved' ? 'Build course' : 'View'}
              </Link>
            </div>,
          ],
        };
      })}
    />
  );
}

export function AdminCourseWorkspace({
  p,
  courses,
  save,
  name,
}: {
  p: PlatformState;
  courses: Course[];
  save: Save;
  name: (id: string) => string;
}) {
  const proposals = p.courseCommerce?.proposals ?? [];
  const purchases = p.courseCommerce?.purchases ?? [];
  const commit = (action: CourseCommand) => save(action);
  const [params] = useSearchParams();
  const selected = proposals.find((entry) => entry.id === params.get('proposal'));
  const proposalList = '/dashboard/workspace?tab=admin-courses&view=proposals';
  if (selected && selected.status !== 'pending')
    return (
      <section className="workspace-record">
        <Link to={proposalList}>← Course proposals</Link>
        <h3>{selected.title}</h3>
        <WorkspaceStatus>{selected.status}</WorkspaceStatus>
        <ProposalDetails proposal={selected} />
      </section>
    );
  return (
    <WorkspaceTabs
      label="Course administration"
      views={[
        {
          id: 'proposals',
          label: 'Proposals',
          count: proposals.filter((row) => row.status === 'pending').length,
          content: (
            <WorkspaceTable
              label="course proposals"
              columns={['Proposal', 'Mentor', 'Status', 'Action']}
              rows={proposals.map((proposal) => ({
                id: proposal.id,
                search: [proposal.title, name(proposal.mentorId), proposal.status].join(' '),
                cells: [
                  proposal.title,
                  name(proposal.mentorId),
                  <WorkspaceStatus>{proposal.status}</WorkspaceStatus>,
                  proposal.status === 'pending' ? (
                    <WorkspaceFormDialog
                      action="Review proposal"
                      title={proposal.title}
                      submit="Save decision"
                      onSave={(data) =>
                        commit({
                          type: 'course-proposal-review',
                          id: proposal.id,
                          decision:
                            field(data, 'decision') === 'approved' ? 'approved' : 'rejected',
                          feedback: field(data, 'feedback'),
                          royaltyPercent: Number(field(data, 'royalty')),
                          now: now(),
                        })
                      }
                    >
                      <ProposalDetails proposal={proposal} />
                      <label>
                        Decision
                        <select name="decision">
                          <option value="approved">Approve and unlock course builder</option>
                          <option value="rejected">Reject</option>
                        </select>
                      </label>
                      <label>
                        Feedback
                        <textarea name="feedback" required minLength={5} maxLength={3000} />
                      </label>
                      <label>
                        Mentor royalty (%)
                        <input
                          name="royalty"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          required
                          defaultValue={20}
                        />
                      </label>
                    </WorkspaceFormDialog>
                  ) : (
                    <Link
                      to={proposalList + '&proposal=' + encodeURIComponent(proposal.id)}
                      aria-label="View decision"
                    >
                      View
                    </Link>
                  ),
                ],
              }))}
            />
          ),
        },
        {
          id: 'catalogue',
          label: 'Course catalogue',
          count: courses.length,
          content: (
            <WorkspaceTable
              label="course pricing"
              columns={['Course', 'Price', 'Discount', 'Action']}
              rows={courses.map((course) => {
                const pricing = coursePricing(p, course.id);
                return {
                  id: course.id,
                  search: course.title,
                  cells: [
                    course.title,
                    amount(pricing.price),
                    amount(pricing.discount),
                    <WorkspaceFormDialog
                      action="Edit pricing"
                      title={course.title}
                      submit="Save pricing"
                      onSave={(data) =>
                        commit({
                          type: 'course-price',
                          id: course.id,
                          price: Number(field(data, 'price')),
                          discount: Number(field(data, 'discount')),
                          now: now(),
                        })
                      }
                    >
                      <label>
                        Standard price (KES)
                        <input
                          name="price"
                          type="number"
                          min={0}
                          max={1000000}
                          step={1}
                          required
                          defaultValue={pricing.price}
                        />
                      </label>
                      <label>
                        Discount amount (KES)
                        <input
                          name="discount"
                          type="number"
                          min={0}
                          max={1000000}
                          step={1}
                          required
                          defaultValue={pricing.discount}
                        />
                      </label>
                      <Link
                        to={'/learn/' + encodeURIComponent(course.id)}
                        aria-label="View public course description"
                      >
                        View
                      </Link>
                    </WorkspaceFormDialog>,
                  ],
                };
              })}
            />
          ),
        },
        {
          id: 'sales',
          label: 'Sales and royalties',
          count: purchases.length,
          content: (
            <WorkspaceTable
              label="course sales"
              columns={['Course', 'Learner', 'Paid', 'Mentor royalty', 'Date']}
              rows={[...purchases].reverse().map((row) => {
                const title =
                  courses.find((course) => course.id === row.courseId)?.title ?? row.courseId;
                const learner = name(row.accountId);
                return {
                  id: row.courseId + ':' + row.accountId,
                  search: title + ' ' + learner,
                  cells: [
                    title,
                    learner,
                    amount(row.amount),
                    amount(row.royaltyCents / 100),
                    new Date(row.paidAt).toLocaleDateString('en-KE'),
                  ],
                };
              })}
            />
          ),
        },
      ]}
    />
  );
}
