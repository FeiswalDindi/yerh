import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Course } from '../../domain/hub';
import type { DemoState } from '../../domain/demo';
import {
  courseCompletionKey,
  courseCompletionRecords,
  type CourseCompletion,
} from '../../domain/courses';
import { roleLabels } from '../../domain/roles';
import type { Save } from './TrainingForms';
import { WorkspaceFormDialog, WorkspaceStatus, WorkspaceTable } from './WorkspaceControls';

const date = new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeZone: 'Africa/Nairobi' });

export function CourseCertificates({
  state,
  courses,
  pending,
  save,
}: {
  state: DemoState;
  courses: Course[];
  pending: CourseCompletion[];
  save: Save;
}) {
  const [filter, setFilter] = useState('');
  const titles = new Map(courses.map((course) => [course.id, course.title]));
  const learners = new Map(state.accounts.map((account) => [account.id, account]));
  const history = new Map(
    courseCompletionRecords(state).map((record) => [courseCompletionKey(record), record]),
  );
  const issued = state.platform.certificates;
  const records = [
    ...pending.map((record) => ({ record, certificate: undefined })),
    ...[...issued]
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      .map((certificate) => ({
        record: history.get(courseCompletionKey(certificate)) ?? certificate,
        certificate,
      })),
  ].filter(({ certificate }) => !filter || filter === (certificate ? 'issued' : 'pending'));
  return (
    <WorkspaceTable
      label="course certificates"
      columns={['Learner', 'Role', 'Course', 'Completed', 'Certificate', 'Action']}
      empty={
        filter === 'issued'
          ? 'No course certificates have been issued.'
          : 'No completed courses match this view.'
      }
      actions={
        <label className="workspace-toolbar-filter">
          Certificate
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">All completions</option>
            <option value="pending">Ready to issue</option>
            <option value="issued">Issued</option>
          </select>
        </label>
      }
      rows={records.map(({ record, certificate }) => {
        const learner = learners.get(record.accountId);
        const name = learner?.name ?? record.accountId;
        const role = learner ? roleLabels[learner.role] : '—';
        const title = titles.get(record.courseId) ?? 'Course completion';
        const completedAt = 'completedAt' in record ? record.completedAt : undefined;
        return {
          id: courseCompletionKey(record),
          search: [name, role, title].join(' '),
          cells: [
            name,
            role,
            title,
            completedAt ? date.format(new Date(completedAt)) : '—',
            <WorkspaceStatus>{certificate ? 'Issued' : 'Ready to issue'}</WorkspaceStatus>,
            certificate ? (
              <Link
                to={`/certificates/${certificate.id}`}
                aria-label={`View certificate for ${name}`}
              >
                View
              </Link>
            ) : (
              <WorkspaceFormDialog
                action="Issue certificate"
                title={`${name} · ${title}`}
                submit="Confirm and issue"
                onSave={() =>
                  save({
                    type: 'certificate-issue',
                    id: crypto.randomUUID(),
                    accountId: record.accountId,
                    courseId: record.courseId,
                    now: new Date().toISOString(),
                  })
                }
              >
                <p>
                  Issue the {title} certificate to {name}.
                </p>
              </WorkspaceFormDialog>
            ),
          ],
        };
      })}
    />
  );
}
