export type Role =
  | 'guest'
  | 'entrepreneur'
  | 'mentor'
  | 'content_manager'
  | 'partner'
  | 'investor'
  | 'admin'
  | 'school_admin';
export type AppliedRole = 'entrepreneur' | 'mentor' | 'partner' | 'investor';
export const roleLabels: Record<Role, string> = {
  guest: 'Guest',
  entrepreneur: 'Youth Entrepreneur / Learner',
  mentor: 'Mentor',
  content_manager: 'Content Manager',
  partner: 'Partner',
  investor: 'Investor',
  admin: 'Platform Administrator',
  school_admin: 'Institutional Administrator',
};
export const applicationRoles: AppliedRole[] = ['entrepreneur', 'mentor', 'partner', 'investor'];
export type Capability =
  | 'community'
  | 'learn'
  | 'attend'
  | 'venture'
  | 'apply'
  | 'mentor'
  | 'organisation'
  | 'cms'
  | 'school'
  | 'admin';
const permissions: Record<Role, Capability[]> = {
  guest: ['learn', 'attend'],
  entrepreneur: ['community', 'learn', 'attend', 'venture', 'apply'],
  mentor: ['community', 'attend', 'mentor'],
  partner: ['community', 'attend', 'organisation'],
  investor: ['community', 'attend', 'organisation'],
  content_manager: ['community', 'cms'],
  school_admin: ['school', 'venture'],
  admin: ['community', 'attend', 'cms', 'admin'],
};
export function can(
  account: { role: Role; suspended?: boolean } | null | undefined,
  capability: Capability,
): boolean {
  return !!account && !account.suspended && permissions[account.role]?.includes(capability);
}
export function canonicalRole(role: string): Role {
  if (role === 'mentee') return 'entrepreneur';
  if (role === 'editor') return 'content_manager';
  return Object.hasOwn(roleLabels, role) ? (role as Role) : 'guest';
}

export function displayRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
    case 'content_manager':
    case 'editor':
      return 'YERH Team';
    case 'entrepreneur':
    case 'mentee':
      return 'Entrepreneur';
    case 'mentor':
      return 'Mentor';
    case 'partner':
      return 'Partner';
    case 'investor':
      return 'Investor';
    case 'school_admin':
      return 'Institution Staff';
    case 'guest':
      return 'Member';
    default:
      return roleLabels[role as Role] ?? role;
  }
}
