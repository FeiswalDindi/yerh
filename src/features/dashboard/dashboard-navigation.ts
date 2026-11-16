import { can, type Capability, type Role } from '../../domain/roles';

type AccountAccess = { role: Role; suspended?: boolean };
type WorkspaceGroup = 'venture' | 'mentor' | 'organisation' | 'admin';
type WorkspaceModule = { id: string; label: string; description: string };

const workspaceGroups = {
  venture: [
    {
      id: 'ventures',
      label: 'My ventures',
      description: 'Create a venture profile and track approvals.',
    },
    { id: 'products', label: 'Products', description: 'Manage products linked to your ventures.' },
    {
      id: 'incubation',
      label: 'Incubation',
      description: 'Apply for incubation and follow your milestones.',
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
      label: 'My opportunities',
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
      description: 'Decide role, venture, organisation and incubation requests.',
    },
    { id: 'users', label: 'Users & roles', description: 'Assign roles and manage account access.' },
    {
      id: 'reports',
      label: 'Analytics & reports',
      description: 'Check platform activity and export the audit log.',
    },
    { id: 'certificates', label: 'Certificates', description: 'Issue course completion records.' },
  ],
} satisfies Record<WorkspaceGroup, WorkspaceModule[]>;

const workspaceOrder: Record<Role, WorkspaceGroup[]> = {
  guest: [],
  entrepreneur: ['venture'],
  mentor: ['mentor'],
  content_manager: [],
  investor: ['organisation'],
  partner: ['organisation'],
  admin: ['admin', 'venture', 'mentor', 'organisation'],
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
export const cmsHref = (id: string) =>
  id === 'overview' ? '/dashboard/cms' : `/dashboard/cms?module=${id}`;

function modulesFor(account: AccountAccess, group: WorkspaceGroup) {
  const modules = workspaceGroups[group];
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
};

const applicationLink = {
  label: 'Role applications',
  to: '/dashboard/applications',
  description: 'Apply for access and follow the decision.',
};
const mentorshipLink = {
  label: 'Mentorship requests',
  to: '/dashboard/mentorship',
  description: 'View requests and their status.',
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
): { label: string; links: DashboardLink[] }[] {
  const groups: { label: string; links: DashboardLink[] }[] = [
    { label: 'Dashboard', links: [{ label: 'Overview', to: '/dashboard' }] },
  ];
  for (const group of workspaceOrder[account.role]) {
    if (!can(account, group)) continue;
    const links: DashboardLink[] = modulesFor(account, group).map(({ id, label, description }) => ({
      label,
      description,
      to: workspaceHref(id),
    }));
    if (group === 'venture')
      links.push({
        label: 'My learning',
        to: '/dashboard/learning',
        description: 'Continue your enrolled courses.',
      });
    if (group === 'mentor') links.unshift(mentorshipLink);
    if (group === 'venture' && !can(account, 'mentor') && can(account, 'apply'))
      links.push(mentorshipLink);
    groups.push({
      label:
        group === 'organisation'
          ? `${account.role === 'investor' ? 'Investor' : account.role === 'partner' ? 'Partner' : 'Organisation'} tools`
          : groupLabels[group],
      links,
    });
    if (group === 'admin' && can(account, 'cms'))
      groups.push({ label: 'Editorial', links: contentLinks });
  }
  if (can(account, 'cms') && !can(account, 'admin'))
    groups.push({ label: 'Editorial', links: contentLinks });

  const accountLinks: DashboardLink[] = [
    { label: 'My profile', to: '/dashboard/profile' },
    applicationLink,
  ];
  if (can(account, 'attend')) accountLinks.push({ label: 'My events', to: '/dashboard/events' });
  if (can(account, 'community') && !can(account, 'cms'))
    accountLinks.push({ label: 'My contributions', to: '/dashboard/content' });
  if (can(account, 'learn') && !can(account, 'venture'))
    accountLinks.push({ label: 'My learning', to: '/dashboard/learning' });
  groups.push({ label: 'Account', links: accountLinks });
  return groups;
}

export const dashboardAccess = {
  mentorship: ['apply', 'mentor'],
  content: ['community'],
  cms: ['cms'],
  moderation: ['cms'],
  learning: ['learn'],
  events: ['attend'],
} satisfies Record<string, Capability[]>;
