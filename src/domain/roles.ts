export type Role =
  'guest' | 'entrepreneur' | 'mentor' | 'content_manager' | 'partner' | 'investor' | 'admin';
export type AppliedRole = 'entrepreneur' | 'mentor' | 'partner' | 'investor';
export const roleLabels: Record<Role, string> = {
  guest: 'Guest',
  entrepreneur: 'Youth Entrepreneur / Learner',
  mentor: 'Mentor',
  content_manager: 'Content Manager',
  partner: 'Partner',
  investor: 'Investor',
  admin: 'Platform Administrator',
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
  | 'admin';
const permissions: Record<Role, Capability[]> = {
  guest: [],
  entrepreneur: ['community', 'learn', 'attend', 'venture', 'apply'],
  mentor: ['community', 'learn', 'attend', 'mentor'],
  partner: ['community', 'attend', 'organisation'],
  investor: ['community', 'attend', 'organisation'],
  content_manager: ['community', 'cms'],
  admin: [
    'community',
    'learn',
    'attend',
    'venture',
    'apply',
    'mentor',
    'organisation',
    'cms',
    'admin',
  ],
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
