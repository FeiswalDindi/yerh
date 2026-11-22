import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/useDemo';
import { WorkspaceDialog } from '../platform/WorkspaceControls';

export function CourseEntryLink({
  courseId,
  courseName,
  to,
  className,
  children,
}: {
  courseId: string;
  courseName: string;
  to: string;
  className: string;
  children: ReactNode;
}) {
  const { state, account } = useDemo();
  const enrolled = account && state.platform.enrollments[account.id]?.includes(courseId);
  const action = enrolled ? 'Continue course' : 'Open course';

  return (
    <WorkspaceDialog
      action={action}
      title={enrolled ? 'Continue this course?' : 'Take this course?'}
      renderTrigger={(open) => (
        <Link
          to={to}
          className={className}
          aria-haspopup="dialog"
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            open();
          }}
        >
          {children}
        </Link>
      )}
    >
      {(finish) => (
        <>
          <p>
            Open the course workspace for <strong>{courseName}</strong>?
          </p>
          <div className="workspace-form-footer">
            <button type="button" className="button button-outline" onClick={() => finish(true)}>
              Cancel
            </button>
            <Link to={to} className="button" onClick={() => finish(true)}>
              {action}
            </Link>
          </div>
        </>
      )}
    </WorkspaceDialog>
  );
}
