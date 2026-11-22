import { can, type Capability, type Role } from '../../domain/roles';
import type { Institution } from '../../domain/incubation';
import { dashboardCataloguePaths } from './catalogue-paths';

type AccountAccess = { role: Role; suspended?: boolean };
type WorkspaceGroup = 'venture' | 'mentor' | 'organisation' | 'admin' | 'school';
type WorkspaceModule = { id: string; label: string; description: string };

const workspaceGroups = {
  venture: [
    {
      id: 'ventures',
      label: 'Ventures',
      description: 'Create a venture profile and track approvals.',
    },
    { id: 'products', label: 'Products', description: 'Manage products linked to your ventures.' },
    {
      id: 'incubation',
      label: 'Incubation',
      description: 'Launch a venture and complete its three incubation stages.',
    },
    {
      id: 'applications',
      label: 'Opportunity applications',
      description: 'Track the opportunities you applied for.',
    },
  ],
  mentor: [
    { id: 'mentor', label: 'Mentor profile', description: 'Set your expertise and availability.' },
    {
      id: 'course-proposals',
      label: 'Course proposals',
      description: 'Propose courses, build approved modules, and track royalties.',
    },
    {
      id: 'mentees',
      label: 'Mentees & milestones',
      description: 'Follow the founders you support.',
    },
  ],
  organisation: [
    {
      id: 'organisation',
      label: 'Organisation',
      description: 'Complete your organisation profile and track approval.',
    },
    {
      id: 'opportunities',
      label: 'Opportunities',
      description: 'Create and manage listings for entrepreneurs.',
    },
    {
      id: 'applicants',
      label: 'Applicants',
      description: 'Review applications to your opportunities.',
    },
    {
      id: 'discovery',
      label: 'Venture discovery',
      description: 'Explore approved ventures from the community.',
    },
  ],
  admin: [
    {
      id: 'approvals',
      label: 'Approval queue',
      description:
        'Moderate product listings, assign incubation mentors, and review other requests.',
    },
    {
      id: 'manage-ventures',
      label: 'Manage ventures',
      description: 'Find and manage ventures across the platform.',
    },
    {
      id: 'manage-products',
      label: 'Marketplace products',
      description: 'Review and manage marketplace listings across all ventures.',
    },
    {
      id: 'admin-courses',
      label: 'Courses',
      description: 'Review proposals and manage course pricing and paid enrollments.',
    },
    { id: 'users', label: 'Users & roles', description: 'Assign roles and manage account access.' },
    {
      id: 'reports',
      label: 'Analytics & reports',
      description: 'Check platform activity and export the audit log.',
    },
    {
      id: 'certificates',
      label: 'Certificates',
      description: 'Approve incubation and course certificates.',
    },
    {
      id: 'payments',
      label: 'Payments',
      description: 'Set fees and review demo payments by purpose.',
    },
    {
      id: 'institutions',
      label: 'Institution directory',
      description: 'Onboard institutions and feature their success stories.',
    },
  ],
  school: [
    {
      id: 'school',
      label: 'Institution portal',
      description: 'Manage programme participants and agreements.',
    },
    {
      id: 'member-results',
      label: 'Results & Certificates',
      description: 'Manage cohort marks and request or download certificates.',
    },
  ],
} satisfies Record<WorkspaceGroup, WorkspaceModule[]>;

const workspaceOrder: Record<Role, WorkspaceGroup[]> = {
  guest: [],
  entrepreneur: ['venture'],
  mentor: ['mentor'],
  content_manager: [],
  investor: ['organisation'],
  partner: ['organisation'],
  admin: ['admin'],
  school_admin: ['school', 'venture'],
};

export const cmsModules = [
  ['overview', 'Studio overview'],
  ['items', 'Articles, stories & listings'],
  ['homepage', 'Homepage & featured content'],
  ['site', 'Pages, navigation & settings'],
  ['team', 'Our Team'],
  ['courses', 'Courses'],
  ['lessons', 'Lessons & media'],
  ['topics', 'Resource pathways'],
  ['faqs', 'FAQs'],
  ['sidebar', 'Sidebar widgets'],
  ['media', 'Media library & partners'],
  ['terms', 'Terms & conditions'],
  ['sessions', 'Events & workshops'],
  ['opportunities', 'Opportunities'],
  ['community', 'Community groups & forums'],
  ['revisions', 'Revisions & audit'],
] as const;

export function cmsModule(value: string | null) {
  return cmsModules.find(([key]) => key === value)?.[0] ?? 'overview';
}

export const workspaceHref = (id: string) => `/dashboard/workspace?tab=${id}`;
export const institutionHref = (tab: string, id: string) =>
  workspaceHref(tab) + '&institution=' + encodeURIComponent(id);
export const ventureResultsHref = (base: string, venture: string, cohort = 'all') =>
  base + '&' + new URLSearchParams({ cohort, venture }).toString();
export function institutionModule(
  requested: string | null,
  manage: boolean,
  kind: Institution['kind'] = 'high-school',
) {
  const group =
    kind !== 'high-school'
      ? workspaceGroups.school
      : manage
        ? [
            ...workspaceGroups.school,
            ...workspaceGroups.venture.filter((module) => module.id !== 'applications'),
          ]
        : workspaceGroups.school.filter((module) => module.id === 'member-results');
  return requested ? group.find((module) => module.id === requested) : group[0];
}
export const cmsHref = (id: string) =>
  id === 'overview' ? '/dashboard/cms' : `/dashboard/cms?module=${id}`;

function modulesFor(account: AccountAccess, group: WorkspaceGroup) {
  const modules = workspaceGroups[group];
  if (account.role === 'school_admin' && group === 'venture')
    return modules
      .filter((module) => module.id !== 'applications')
      .map((module) =>
        module.id === 'ventures'
          ? { ...module, description: 'Manage team ventures and their cohorts.' }
          : module,
      );
  if (account.role === 'investor' && group === 'organisation')
    return [
      ...modules.filter((module) => module.id === 'discovery'),
      ...modules.filter((module) => module.id !== 'discovery'),
    ];
  return modules;
}

function workspaceModules(account: AccountAccess) {
  return workspaceOrder[account.role]
    .filter((group) => can(account, group))
    .flatMap((group) => modulesFor(account, group));
}

export function activeWorkspaceModule(account: AccountAccess, requested: string | null) {
  const modules = workspaceModules(account);
  return requested ? modules.find((module) => module.id === requested) : modules[0];
}

interface DashboardLink {
  label: string;
  to: string;
  description?: string;
}

const groupLabels: Record<WorkspaceGroup, string> = {
  admin: 'Administration',
  venture: 'Venture & learning',
  mentor: 'Mentorship',
  organisation: 'Organisation',
  school: 'Institution',
};

const learningLink = {
  label: 'Courses',
  to: dashboardCataloguePaths.learning,
  description: 'Enroll in a course or pick up where you left off.',
};
const eventsLink = {
  label: 'Events',
  to: dashboardCataloguePaths.events,
  description: 'Find workshops and webinars, and manage your reservations.',
};
const certificatesLink = {
  label: 'Certificates',
  to: '/dashboard/certificates',
  description: 'View your earned course completion records.',
};
export const guestResourceLinks = [
  { ...learningLink, label: 'Courses' },
  { ...eventsLink, label: 'Events' },
  {
    label: 'Marketplace',
    to: dashboardCataloguePaths.marketplace,
    description: 'Discover products and services from youth ventures.',
  },
  certificatesLink,
];
const mentorshipLink = {
  label: 'Mentorship requests',
  to: '/dashboard/mentorship',
  description: 'Review and respond to mentorship requests.',
};
const studio = {
  label: 'Content Studio',
  to: '/dashboard/cms',
  description: 'Edit and publish site content.',
};
const contentLinks = [
  studio,
  {
    label: 'Contribution review',
    to: '/dashboard/content',
    description: 'Review submitted stories, blogs and listings.',
  },
  {
    label: 'Discussion moderation',
    to: '/dashboard/moderation',
    description: 'Review discussions and manage visibility.',
  },
];

export function dashboardGroups(
  account: AccountAccess,
  schoolProgramme = true,
): { label: string; links: DashboardLink[] }[] {
  const groups: { label: string; links: DashboardLink[] }[] = [
    { label: 'Dashboard', links: [{ label: 'Overview', to: '/dashboard' }] },
  ];
  for (const group of workspaceOrder[account.role]) {
    if (!can(account, group)) continue;
    if (account.role === 'school_admin' && group === 'venture' && !schoolProgramme) continue;
    const links: DashboardLink[] = modulesFor(account, group)
      .filter((module) => module.id !== 'institutions')
      .filter((module) => schoolProgramme || module.id !== 'member-results')
      .map(({ id, label, description }) => ({
        label,
        description,
        to: workspaceHref(id),
      }));
    if (group === 'venture' && can(account, 'learn')) links.push(learningLink);
    if (group === 'mentor') links.unshift(mentorshipLink);
    if (group === 'admin') links.push(eventsLink);
    if (group === 'venture' && !can(account, 'mentor') && can(account, 'apply'))
      links.push(mentorshipLink);
    groups.push({
      label:
        group === 'organisation'
          ? `${account.role === 'investor' ? 'Investor' : account.role === 'partner' ? 'Partner' : 'Organisation'} tools`
          : groupLabels[group],
      links,
    });
    if (group === 'admin')
      groups.push({
        label: 'Institutions',
        links: [{ label: 'Institution directory', to: workspaceHref('institutions') }],
      });
    if (group === 'admin' && can(account, 'cms'))
      groups.push({ label: 'Editorial', links: contentLinks });
  }
  if (can(account, 'cms') && !can(account, 'admin'))
    groups.push({ label: 'Editorial', links: contentLinks });

  const accountLinks: DashboardLink[] = [{ label: 'Profile', to: '/dashboard/profile' }];
  if (account.role === 'guest') {
    groups.push({ label: 'Explore', links: guestResourceLinks });
  } else {
    if (can(account, 'attend') && account.role !== 'admin') accountLinks.push(eventsLink);
    if (can(account, 'learn') && !can(account, 'venture')) accountLinks.push(learningLink);
    if (!can(account, 'school') && !can(account, 'admin')) accountLinks.push(certificatesLink);
  }
  if (can(account, 'community') && !can(account, 'cms'))
    accountLinks.push({ label: 'Contributions', to: '/dashboard/content' });
  groups.push({ label: 'Account', links: accountLinks });
  return groups;
}

export const dashboardAccess = {
  mentorship: ['apply', 'mentor'],
  content: ['community'],
  cms: ['cms'],
  moderation: ['cms'],
  learning: ['learn'],
  events: ['attend', 'admin'],
} satisfies Record<string, Capability[]>;
