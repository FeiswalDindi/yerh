import { Link } from 'react-router-dom';
import { WorkspaceFormDialog } from '../workspace/WorkspaceControls';

import { Field, Panel, now } from '../workspace/WorkspacePanel';
import type { DemoAccount } from '../../../domain/demo';
import type { PlatformState } from '../../../domain/platform';
import type { Save } from '../incubation/TrainingForms';

export function MentorProfile({
  p,
  account,
  run,
}: {
  p: PlatformState;
  account: DemoAccount;
  run: Save;
}) {
  const mentor = p.mentors.find((m) => m.accountId === account.id);

  return (
    <>
      <Panel title="Mentor profile & availability">
        {mentor && (
          <dl className="workspace-profile">
            <div>
              <dt>Expertise</dt>
              <dd>{mentor.expertise}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{mentor.availability}</dd>
            </div>
            <div>
              <dt>Biography</dt>
              <dd>{mentor.bio}</dd>
            </div>
          </dl>
        )}
        <div className="workspace-toolbar-actions">
          <WorkspaceFormDialog
            action={mentor ? 'Edit mentor profile' : 'Set up mentor profile'}
            create={!mentor}
            submit="Save mentor profile"
            onSave={(f) =>
              run({
                type: 'mentor-profile',
                now: now(),
                profile: {
                  accountId: account.id,
                  expertise: String(f.get('expertise')),
                  availability: String(f.get('availability')),
                  bio: String(f.get('bio')),
                },
              })
            }
          >
            <Field
              label="Expertise"
              name="expertise"
              minLength={5}
              defaultValue={mentor?.expertise}
            />
            <Field
              label="Availability (include timezone)"
              name="availability"
              minLength={5}
              defaultValue={mentor?.availability}
            />
            <Field
              label="Mentor biography"
              name="bio"
              type="textarea"
              minLength={20}
              defaultValue={mentor?.bio}
            />
          </WorkspaceFormDialog>
          <Link to="/dashboard/mentorship" aria-label="Review mentorship requests">
            Review
          </Link>
        </div>
      </Panel>{' '}
    </>
  );
}
