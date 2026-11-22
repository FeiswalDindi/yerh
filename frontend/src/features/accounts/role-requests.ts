import type { RoleApplication } from '../../domain/platform';

export const roleApplicationPath = '/dashboard/applications';
export const roleAccessSectionId = 'role-access';
export const roleAccessPath = `/dashboard/profile#${roleAccessSectionId}`;

export function accountRoleRequests(applications: RoleApplication[], accountId: string) {
  return applications
    .filter((application) => application.accountId === accountId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
