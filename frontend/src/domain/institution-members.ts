import type { DemoAccount, DemoState } from './demo';
import type { PlatformState } from './platform';
import { accountInstitution, activeIncubationPartner, institutionAccess } from './incubation.ts';
import { can } from './roles.ts';

type InvitationStatus = 'pending' | 'accepted' | 'revoked';
export interface InstitutionInvitation {
  id: string;
  institutionId: string;
  name: string;
  email: string;
  invitedAt: string;
  invitedBy: string;
  status: InvitationStatus;
  acceptedAccountId?: string;
}

type InvitationEntry = { id: string; name: string; email: string };
export const institutionInvitationLimit = 100;

export function institutionProgrammeMembers(
  p: PlatformState,
  accounts: DemoAccount[],
  institutionId: string,
) {
  return accounts.filter(
    (account) =>
      account.role === 'entrepreneur' && p.training.affiliations[account.id] === institutionId,
  );
}

export type InstitutionInvitationAction = (
  | ({ type: 'institution-invite'; institutionId: string } & InvitationEntry)
  | { type: 'institution-invite-bulk'; institutionId: string; entries: InvitationEntry[] }
  | { type: 'institution-invite-revoke'; id: string; institutionId: string }
  | {
      type: 'institution-invite-accept';
      id: string;
      accountId: string;
      location: string;
      consent: boolean;
    }
) & { now: string };

type StaffInvitationAction = Exclude<
  InstitutionInvitationAction,
  { type: 'institution-invite-accept' }
>;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hasInstitutionAccess(p: PlatformState, account: DemoAccount) {
  return p.training.institutions.some((institution) => institutionAccess(institution, account));
}

export function institutionSignInProblem(
  p: PlatformState,
  account: DemoAccount,
  institutionId: string,
) {
  const affiliation = accountInstitution(p, account.id);
  const mismatch =
    'This email cannot sign in to the selected institution. Choose the institution linked to this account.';
  if (affiliation && affiliation.id !== institutionId) return mismatch;
  if (institutionId === 'yerh')
    return p.training.yerhSignIn === false ? 'YERH sign-in is currently unavailable.' : null;
  const institution = p.training.institutions.find(
    (row) => row.id === institutionId && row.status === 'active',
  );
  if (!institution) return 'Choose an institution with an active portal.';
  if (affiliation || institutionAccess(institution, account)) return null;
  if (!['guest', 'entrepreneur'].includes(account.role) || hasInstitutionAccess(p, account))
    return mismatch;
  const invited = p.institutionInvitations?.some(
    (row) =>
      row.institutionId === institution.id &&
      row.status === 'pending' &&
      row.email === account.email.toLowerCase(),
  );
  return invited || account.preferredInstitutionId === institution.id ? null : mismatch;
}

export function institutionMembershipProblem(
  p: PlatformState,
  accountId: string,
  institutionId: string,
) {
  const current = accountInstitution(p, accountId);
  return current && current.id !== institutionId
    ? 'This account already has an institution affiliation.'
    : null;
}

function eligibleAccount(p: PlatformState, account: DemoAccount, institutionId: string) {
  check(
    !account.suspended && ['guest', 'entrepreneur'].includes(account.role),
    'This invitation requires an active guest or entrepreneur account.',
  );
  check(
    !hasInstitutionAccess(p, account),
    'Use a learner account for this invitation. The email belongs to an institution staff or contact account.',
  );
  const problem = institutionMembershipProblem(p, account.id, institutionId);
  if (problem) throw new Error(problem);
}

export function manageInstitutionInvitation(
  p: PlatformState,
  accounts: DemoAccount[],
  operator: DemoAccount,
  action: StaffInvitationAction,
) {
  const institution = activeIncubationPartner(p, action.institutionId);
  check(
    institution &&
      (can(operator, 'admin') || institutionAccess(institution, operator) === 'manage'),
    'An active university or hub and authorized staff access are required.',
  );
  const invitations = p.institutionInvitations ?? [];
  if (action.type === 'institution-invite-revoke') {
    const invite = invitations.find(
      (entry) => entry.id === action.id && entry.institutionId === institution.id,
    );
    check(invite?.status === 'pending', 'Choose an invitation awaiting acceptance.');
    invite.status = 'revoked';
    return [invite.id];
  }
  const bulk = action.type === 'institution-invite-bulk';
  const entries = bulk ? action.entries : [action];
  check(
    entries.length > 0 && entries.length <= institutionInvitationLimit,
    `Enter between 1 and ${institutionInvitationLimit} members.`,
  );
  const invitationIds = new Set(invitations.map(({ id }) => id));
  const pendingEmails = new Set(
    invitations
      .filter(({ status }) => status === 'pending')
      .map(({ email }) => email.toLowerCase()),
  );
  const batchEmails = new Set<string>();
  const accountsByEmail = new Map(
    accounts.map((account) => [account.email.toLowerCase(), account]),
  );
  const created = entries.map((entry, index): InstitutionInvitation => {
    try {
      const email = entry.email.trim().toLowerCase();
      const name = entry.name.trim();
      check(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254,
        'Enter a valid email.',
      );
      check(name.length >= 2 && name.length <= 80, 'Enter a name from 2 to 80 characters.');
      check(entry.id && !invitationIds.has(entry.id), 'This invitation already exists.');
      check(!batchEmails.has(email), 'This email appears more than once in the batch.');
      check(!pendingEmails.has(email), 'This email already has a pending invitation.');
      const existing = accountsByEmail.get(email);
      if (existing) {
        eligibleAccount(p, existing, institution.id);
        check(
          existing.role !== 'entrepreneur' ||
            p.training.affiliations[existing.id] !== institution.id,
          'This entrepreneur is already a member of this institution.',
        );
      }
      invitationIds.add(entry.id);
      batchEmails.add(email);
      return {
        id: entry.id,
        institutionId: institution.id,
        name,
        email,
        invitedAt: action.now,
        invitedBy: operator.id,
        status: 'pending',
      };
    } catch (error) {
      if (!bulk || !(error instanceof Error)) throw error;
      throw new Error(`Entry ${index + 1}. ${error.message}`);
    }
  });
  p.institutionInvitations = [...invitations, ...created];
  return created.map(({ id }) => id);
}

export function acceptInstitutionInvitation(
  state: DemoState,
  operator: DemoAccount | null,
  action: Extract<InstitutionInvitationAction, { type: 'institution-invite-accept' }>,
): DemoState {
  const p = structuredClone(state.platform);
  const invite = p.institutionInvitations?.find((entry) => entry.id === action.id);
  check(
    invite?.status === 'pending' && activeIncubationPartner(p, invite.institutionId),
    'This invitation is no longer available.',
  );
  const existing = state.accounts.find((account) => account.email.toLowerCase() === invite.email);
  if (existing) {
    check(operator?.id === existing.id, 'Sign in with the invited email before accepting.');
    eligibleAccount(p, existing, invite.institutionId);
  } else {
    check(!operator, 'Sign out before activating an invitation for another account.');
    check(action.consent, 'Consent is required to create a demo account.');
    check(
      action.accountId && !state.accounts.some((account) => account.id === action.accountId),
      'Choose a unique account identifier.',
    );
    check(
      action.location.trim().length >= 2 && action.location.trim().length <= 80,
      'Enter a city or county from 2 to 80 characters.',
    );
  }
  const member: DemoAccount = existing
    ? { ...existing, role: 'entrepreneur' }
    : {
        id: action.accountId,
        name: invite.name,
        email: invite.email,
        role: 'entrepreneur',
        headline: 'Youth entrepreneur',
        location: action.location.trim(),
        bio: 'Building a venture through the YERH incubation pathway.',
        skills: [],
        handle: action.accountId,
        joinedAt: action.now.slice(0, 10),
      };
  invite.status = 'accepted';
  invite.acceptedAccountId = member.id;
  p.training.affiliations[member.id] = invite.institutionId;
  for (const request of p.applications) {
    if (
      request.accountId === member.id &&
      request.status === 'pending' &&
      existing?.role === 'guest'
    ) {
      request.status = 'withdrawn';
      request.reason = 'This request was closed when you accepted an institutional invitation.';
      request.reviewedBy = invite.invitedBy;
    }
  }
  p.audit.unshift({
    id: `audit-${p.audit.length}-${action.now}`,
    action: action.type,
    actorId: member.id,
    institutionId: invite.institutionId,
    targetId: invite.id,
    createdAt: action.now,
  });
  return {
    ...state,
    platform: p,
    activeAccountId: member.id,
    accounts: existing
      ? state.accounts.map((account) => (account.id === member.id ? member : account))
      : [...state.accounts, member],
  };
}
