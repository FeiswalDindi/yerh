import { useState, type FormEvent } from 'react';
import { useDemo } from '../../app/useDemo';
import type { DemoAccount } from '../../domain/demo';
import type { RoleApplication } from '../../domain/platform';
import { applicationRoles, roleLabels, type AppliedRole } from '../../domain/roles';
import {
  accountInstitution,
  activeIncubationPartner,
  institutionKindLabels,
} from '../../domain/incubation';

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
  const { execute, state, error } = useDemo();
  const p = state.platform;
  const isApplication = account.role === 'guest';
  const affiliation = accountInstitution(p, account.id);
  const institutions = p.training.institutions.filter(
    (row) => (!affiliation || affiliation.id === row.id) && activeIncubationPartner(p, row.id),
  );
  const preferred = affiliation?.id ?? account.preferredInstitutionId;
  const options = applicationRoles.filter((role) => role !== account.role);
  const [selectedRole, setSelectedRole] = useState<AppliedRole>();
  const [failed, setFailed] = useState(false);
  const role = selectedRole && options.includes(selectedRole) ? selectedRole : options[0]!;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = execute({
      type: isApplication ? 'role-apply' : 'role-change-request',
      id: crypto.randomUUID(),
      role,
      motivation: String(form.get('motivation') ?? ''),
      organisation: String(form.get('organisation') ?? ''),
      expertise: String(form.get('expertise') ?? ''),
      institutionId: role === 'entrepreneur' ? String(form.get('institution') ?? '') : undefined,
      now: new Date().toISOString(),
    });
    setFailed(!saved);
    if (saved) {
      event.currentTarget.reset();
      setSelectedRole(undefined);
    }
  }

  if (pending)
    return (
      <p className="role-request-status" role="status">
        Your request for <strong>{roleLabels[pending.role]}</strong> is pending review.
        {isApplication && ' You can continue taking general courses and attending events.'}
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
      {role === 'entrepreneur' && (
        <label>
          Affiliated university or hub
          <select
            name="institution"
            defaultValue={institutions.some(({ id }) => id === preferred) ? preferred : ''}
            required
          >
            <option value="">Choose your institution</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name} · {institutionKindLabels[institution.kind]}
              </option>
            ))}
          </select>
          <small>
            Describe your affiliation and venture plans below so YERH can review your application.
          </small>
        </label>
      )}
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
      {failed && error && <p role="alert">{error}</p>}
      <button className="button" type="submit">
        {isApplication ? 'Submit application' : 'Submit role change request'}
      </button>
    </form>
  );
}

export function RoleRequestHistory({ requests }: { requests: RoleApplication[] }) {
  const { state } = useDemo();
  if (!requests.length) return null;

  return (
    <section className="role-request-history" aria-label="Role request history">
      <h3>Request history</h3>
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <div className="role-request-history-heading">
              <strong>{roleLabels[request.role]}</strong>
              <span>
                {
                  {
                    pending: 'Pending',
                    approved: 'Approved',
                    rejected: 'Rejected',
                    withdrawn: 'Closed',
                  }[request.status]
                }
              </span>
            </div>
            {request.institutionId && (
              <p>
                {
                  state.platform.training.institutions.find(
                    (row) => row.id === request.institutionId,
                  )?.name
                }
              </p>
            )}
            <p>{request.motivation}</p>
            {request.reason && <p>Reviewer feedback: {request.reason}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
