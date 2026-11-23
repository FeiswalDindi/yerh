import { useState } from 'react';
import { WorkspaceAction, fieldValue } from './WorkspaceActions';
import type { ReviewStatus } from '../../../services/laravel-programme-repository';
export function RegistryReview({
  current,
  name,
  description,
  note,
  decide,
}: {
  current: ReviewStatus;
  name: string;
  description: string;
  note: string | null;
  decide: (decision: string, note: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(current);
  return (
    <WorkspaceAction
      action="Review record"
      title={name}
      submit="Save status"
      save={async (data) => {
        await decide(fieldValue(data, 'status'), fieldValue(data, 'note'));
      }}
    >
      <p>{description}</p>
      <label>
        Status
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ReviewStatus)}
        >
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label>
        {status === 'rejected' ? 'Reason for rejection' : 'Note (optional)'}
        <textarea
          name="note"
          defaultValue={note ?? ''}
          required={status === 'rejected'}
          maxLength={1500}
        />
      </label>
    </WorkspaceAction>
  );
}
