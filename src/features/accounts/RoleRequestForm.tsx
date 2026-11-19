import { useState, type FormEvent } from 'react';
import { useDemo } from '../../app/useDemo';
import type { DemoAccount } from '../../domain/demo';
import type { RoleApplication } from '../../domain/platform';
import { applicationRoles, roleLabels, type AppliedRole } from '../../domain/roles';

const roleDescriptions: Record<AppliedRole, string> = {
  entrepreneur: 'Build your venture and apply for support.',
  mentor: 'Share your expertise and guide entrepreneurs.',
  partner: 'Offer programmes, market access, or technical support.',
  investor: 'Discover ventures and offer funding opportunities.',
};

export function RoleRequestForm({
  account,
  pending,
}: {
  account: DemoAccount;
  pending?: RoleApplication;
}) {
  const { execute } = useDemo();
  const isApplication = account.role === 'guest';
  const options = applicationRoles.filter((role) => role !== account.role);
  const [selectedRole, setSelectedRole] = useState<AppliedRole>();
  const role = selectedRole && options.includes(selectedRole) ? selectedRole : options[0]!;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      execute({
        type: isApplication ? 'role-apply' : 'role-change-request',
        id: crypto.randomUUID(),
        role,
        motivation: String(form.get('motivation') ?? ''),
        organisation: String(form.get('organisation') ?? ''),
        expertise: String(form.get('expertise') ?? ''),
        now: new Date().toISOString(),
      })
    ) {
      event.currentTarget.reset();
      setSelectedRole(undefined);
    }
  }

  if (pending)
    return (
      <p className="role-request-status" role="status">
        Your request for <strong>{roleLabels[pending.role]}</strong> is pending review. You can
        continue using your current dashboard and its features.
      </p>
    );

  return (
    <form className="workspace-form role-request-form" onSubmit={submit}>
      <label>
        {isApplication ? 'Choose a role' : 'Requested role'}
        <select
          value={role}
          onChange={(event) => setSelectedRole(event.target.value as AppliedRole)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {roleLabels[option]}
            </option>
          ))}
        </select>
        <small className="role-request-hint">{roleDescriptions[role]}</small>
      </label>
      {(role === 'partner' || role === 'investor') && (
        <label>
          Organisation name
          <input name="organisation" required minLength={3} maxLength={120} />
        </label>
      )}
      {role === 'mentor' && (
        <label>
          Expertise and experience
          <textarea name="expertise" rows={3} required minLength={5} maxLength={500} />
        </label>
      )}
      <label>
        {isApplication ? 'Why are you applying?' : 'Why are you requesting this role change?'}
        <textarea name="motivation" rows={4} required minLength={30} maxLength={2000} />
      </label>
      <button className="button" type="submit">
        {isApplication ? 'Submit application' : 'Submit role change request'}
      </button>
    </form>
  );
}

export function RoleRequestHistory({ requests }: { requests: RoleApplication[] }) {
  if (!requests.length) return null;

  return (
    <section className="role-request-history" aria-label="Role request history">
      <h3>Request history</h3>
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <div className="role-request-history-heading">
              <strong>{roleLabels[request.role]}</strong>
            </div>
            <p>{request.motivation}</p>
            {request.reason && <p>Reviewer feedback: {request.reason}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
