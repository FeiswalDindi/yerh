import type { DemoState } from './demo';
import { can, applicationRoles, roleLabels } from './roles.ts';
import { assertCmsSnapshot, assertOpportunity, safeUrl } from './cms.ts';
import type { PlatformAction, CmsSnapshot, Opportunity } from './platform';
export function isPlatformAction(action: { type: string }): action is PlatformAction {
  return [
    'certificate-issue',
    'signup',
    'role-apply',
    'role-review',
    'account-admin',
    'enroll',
    'venture-save',
    'product-save',
    'venture-review',
    'mentor-profile',
    'organisation-save',
    'opportunity-save',
    'opportunity-status',
    'opportunity-apply',
    'opportunity-review',
    'incubation-apply',
    'incubation-complete',
    'incubation-assign',
    'milestone',
    'cms-save',
    'cms-publish',
    'cms-rollback',
  ].includes(action.type);
}
export function opportunityProblem(opportunity: Opportunity, now: string): string | null {
  const time = Date.parse(now);
  if (!Number.isFinite(time)) return 'Invalid time.';
  if (opportunity.status !== 'published') return 'This opportunity is not open.';
  if (opportunity.opensAt && Date.parse(opportunity.opensAt) > time)
    return 'Applications have not opened.';
  if (!opportunity.rolling && opportunity.deadline && Date.parse(opportunity.deadline) <= time)
    return 'The application deadline has passed.';
  return null;
}
function text(value: string, min = 2, max = 2000) {
  const clean = value.trim();
  if (clean.length < min || clean.length > max)
    throw new Error(`Enter between ${min} and ${max} characters.`);
  return clean;
}
/** Every command rechecks identity, ownership, lifecycle and permissions before persistence. */
export function applyPlatformAction(state: DemoState, action: PlatformAction): DemoState {
  const now = action.now;
  if (!Number.isFinite(Date.parse(now))) throw new Error('Invalid action time.');
  const actor = state.accounts.find((a) => a.id === state.activeAccountId) ?? null;
  if (action.type === 'signup') {
    if (actor) throw new Error('Sign out before creating another account.');
    const email = action.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email.');
    if (!action.consent) throw new Error('Consent is required to create the preview account.');
    if (!action.id || state.accounts.some((a) => a.id === action.id || a.email === email))
      throw new Error('An account already exists with this email.');
    return {
      ...state,
      activeAccountId: action.id,
      accounts: [
        ...state.accounts,
        {
          id: action.id,
          name: text(action.name, 2, 80),
          email,
          role: 'guest',
          headline: 'New YERH member',
          location: text(action.location, 2, 80),
          bio: 'Exploring the YERH community and available pathways.',
          skills: [],
          handle: action.id,
          joinedAt: now.slice(0, 10),
          phone: action.phone.trim(),
          ageRange: action.ageRange,
        },
      ],
    };
  }
  if (!actor || actor.suspended) throw new Error('Sign in with an active account to continue.');
  let p = structuredClone(state.platform);
  let accounts = state.accounts;
  let sessions = state.sessions;
  let forums = state.forums;
  let groups = state.groups;
  const require = (capability: Parameters<typeof can>[1]) => {
    if (!can(actor, capability))
      throw new Error('Your approved role does not have permission for this action.');
  };
  const audit = (targetId: string) =>
    p.audit.unshift({
      id: `audit-${p.audit.length}-${now}`,
      actorId: actor.id,
      action: action.type,
      targetId,
      createdAt: now,
    });
  const update = <T extends { id: string }>(rows: T[], value: T) => [
    ...rows.filter((r) => r.id !== value.id),
    value,
  ];
  switch (action.type) {
    case 'certificate-issue': {
      require('admin');
      const lessons = p.courseLessons[action.courseId];
      if (
        !lessons ||
        !accounts.some((a) => a.id === action.accountId) ||
        !lessons.every((id) => (state.progress[action.accountId] ?? []).includes(id))
      )
        throw new Error('All course lessons must be completed before issuing a certificate.');
      if (
        p.certificates.some(
          (c) => c.accountId === action.accountId && c.courseId === action.courseId,
        )
      )
        throw new Error('A certificate already exists for this course.');
      p.certificates.push({
        id: action.id,
        accountId: action.accountId,
        courseId: action.courseId,
        issuedAt: now,
        issuedBy: actor.id,
      });
      audit(action.id);
      break;
    }

    case 'role-apply': {
      if (!applicationRoles.includes(action.role))
        throw new Error('This role requires staff assignment.');
      if (actor.role === action.role) throw new Error('You already hold this role.');
      if (p.applications.some((a) => a.accountId === actor.id && a.status === 'pending'))
        throw new Error('You already have an application pending review.');
      if (p.applications.some((a) => a.id === action.id))
        throw new Error('Application ID already exists.');
      if (['partner', 'investor'].includes(action.role)) text(action.organisation, 3, 120);
      if (action.role === 'mentor') text(action.expertise, 5, 500);
      p.applications.push({
        id: action.id,
        accountId: actor.id,
        role: action.role,
        motivation: text(action.motivation, 30),
        organisation: action.organisation.trim(),
        expertise: action.expertise.trim(),
        status: 'pending',
        createdAt: now,
      });
      audit(action.id);
      break;
    }
    case 'role-review': {
      require('admin');
      const application = p.applications.find((a) => a.id === action.id);
      if (!application || application.status !== 'pending' || application.accountId === actor.id)
        throw new Error('Only another account’s pending application can be reviewed.');
      application.status = action.decision;
      application.reason = text(action.reason, 10, 1000);
      application.reviewedBy = actor.id;
      if (!['approved', 'rejected'].includes(action.decision))
        throw new Error('Invalid review decision.');
      if (action.decision === 'approved')
        accounts = accounts.map((a) =>
          a.id === application.accountId ? { ...a, role: application.role } : a,
        );
      audit(action.id);
      break;
    }
    case 'account-admin': {
      require('admin');
      if (action.accountId === actor.id)
        throw new Error('You cannot change your own administrative access.');
      if (!accounts.some((a) => a.id === action.accountId)) throw new Error('Account not found.');
      if (action.role && !Object.hasOwn(roleLabels, action.role)) throw new Error('Unknown role.');
      accounts = accounts.map((a) =>
        a.id === action.accountId
          ? {
              ...a,
              ...(action.role ? { role: action.role } : {}),
              ...(action.suspended !== undefined ? { suspended: action.suspended } : {}),
            }
          : a,
      );
      audit(action.accountId);
      break;
    }
    case 'enroll': {
      require('learn');
      if (!p.courseLessons[action.courseId]) throw new Error('Course not found.');
      const ids = p.enrollments[actor.id] ?? [];
      p.enrollments[actor.id] =
        action.operation === 'enroll'
          ? [...new Set([...ids, action.courseId])]
          : ids.filter((id) => id !== action.courseId);
      audit(action.courseId);
      break;
    }
    case 'venture-save': {
      require('venture');
      const old = p.ventures.find((v) => v.id === action.venture.id);
      if (old && old.ownerId !== actor.id && !can(actor, 'admin'))
        throw new Error('This venture belongs to another account.');
      p.ventures = update(p.ventures, {
        ...action.venture,
        ownerId: old?.ownerId ?? actor.id,
        name: text(action.venture.name, 3, 120),
        description: text(action.venture.description, 30),
        sector: text(action.venture.sector),
        stage: text(action.venture.stage),
        location: text(action.venture.location),
        status: 'pending',
      });
      audit(action.venture.id);
      break;
    }
    case 'product-save': {
      require('venture');
      const venture = p.ventures.find(
        (v) =>
          v.id === action.product.ventureId && v.ownerId === actor.id && v.status === 'approved',
      );
      const old = p.products.find((v) => v.id === action.product.id);
      if (!venture || (old && old.ownerId !== actor.id))
        throw new Error('Choose your own approved venture.');
      if (!Number.isFinite(action.product.price) || action.product.price < 0)
        throw new Error('Enter a valid non-negative price.');
      p.products = update(p.products, {
        ...action.product,
        ownerId: actor.id,
        name: text(action.product.name, 3, 120),
        description: text(action.product.description, 20),
        status: 'pending',
      });
      audit(action.product.id);
      break;
    }
    case 'venture-review': {
      require('admin');
      if (action.entity === 'venture') {
        const v = p.ventures.find((v) => v.id === action.id);
        if (!v) throw new Error('Venture not found.');
        v.status = action.decision;
      }
      if (action.entity === 'product') {
        const v = p.products.find((v) => v.id === action.id);
        if (!v) throw new Error('Product not found.');
        v.status = action.decision;
      }
      if (action.entity === 'organisation') {
        const v = p.organisations.find((v) => v.accountId === action.id);
        if (!v) throw new Error('Organisation not found.');
        v.status = action.decision;
      }
      audit(action.id);
      break;
    }
    case 'mentor-profile':
      require('mentor');
      accounts = accounts.map((a) =>
        a.id === actor.id ? { ...a, bio: text(action.profile.bio, 20, 1000) } : a,
      );
      p.mentors = [
        ...p.mentors.filter((m) => m.accountId !== actor.id),
        {
          accountId: actor.id,
          expertise: text(action.profile.expertise, 5, 500),
          availability: text(action.profile.availability, 5, 500),
          bio: text(action.profile.bio, 20, 1000),
        },
      ];
      audit(actor.id);
      break;
    case 'organisation-save':
      require('organisation');
      if (
        !safeUrl(action.organisation.website) ||
        (action.organisation.website && !action.organisation.website.startsWith('https://'))
      )
        throw new Error('Use an HTTPS organisation website.');
      p.organisations = [
        ...p.organisations.filter((o) => o.accountId !== actor.id),
        {
          ...action.organisation,
          accountId: actor.id,
          name: text(action.organisation.name, 3, 120),
          type: text(action.organisation.type),
          contact: text(action.organisation.contact),
          sectors: text(action.organisation.sectors),
          status: 'pending',
        },
      ];
      audit(actor.id);
      break;
    case 'opportunity-save': {
      if (!can(actor, 'organisation') && !can(actor, 'cms'))
        throw new Error('An organisation or content role is required.');
      const old = p.opportunities.find((o) => o.id === action.opportunity.id);
      if (old && old.ownerId !== actor.id && !can(actor, 'cms'))
        throw new Error('You can only edit your own opportunities.');
      if (
        !can(actor, 'cms') &&
        !p.organisations.some((o) => o.accountId === actor.id && o.status === 'approved')
      )
        throw new Error('Your organisation must be approved first.');
      if (
        p.opportunities.some(
          (o) => o.slug === action.opportunity.slug && o.id !== action.opportunity.id,
        )
      )
        throw new Error('This opportunity URL is already in use.');
      const opportunity = {
        ...action.opportunity,
        ownerId: old?.ownerId ?? actor.id,
        status: 'draft' as const,
        publishedAt: old?.publishedAt ?? null,
      };
      assertOpportunity(opportunity);
      p.opportunities = update(p.opportunities, opportunity);
      p.cmsRevision++;
      audit(opportunity.id);
      break;
    }
    case 'opportunity-status': {
      const o = p.opportunities.find((o) => o.id === action.id);
      if (!o) throw new Error('Opportunity not found.');
      if (action.status === 'review') {
        if (o.ownerId !== actor.id && !can(actor, 'cms')) throw new Error('Not your opportunity.');
        if (o.status !== 'draft') throw new Error('Only drafts can be submitted.');
      } else {
        require('cms');
        if (action.status === 'published' && o.status !== 'review')
          throw new Error('Submit the opportunity for review first.');
      }
      o.status = action.status;
      if (action.status === 'published') o.publishedAt = now;
      p.cmsRevision++;
      audit(o.id);
      break;
    }
    case 'opportunity-apply': {
      require('apply');
      const o = p.opportunities.find((o) => o.id === action.opportunityId);
      if (!o) throw new Error('Opportunity not found.');
      const problem = opportunityProblem(o, now);
      if (problem) throw new Error(problem);
      if (o.type !== 'internal')
        throw new Error('Apply through the external organiser for this opportunity.');
      if (o.ownerId === actor.id) throw new Error('You cannot apply to your own opportunity.');
      if (
        !p.ventures.some(
          (v) => v.id === action.ventureId && v.ownerId === actor.id && v.status === 'approved',
        )
      )
        throw new Error('Choose your approved venture.');
      if (
        p.opportunityApplications.some(
          (a) => a.accountId === actor.id && a.opportunityId === o.id && a.status !== 'withdrawn',
        )
      )
        throw new Error('You already applied to this opportunity.');
      if (
        o.capacity !== null &&
        p.opportunityApplications.filter(
          (a) =>
            a.opportunityId === o.id && ['submitted', 'shortlisted', 'accepted'].includes(a.status),
        ).length >= o.capacity
      )
        throw new Error('The application capacity has been reached.');
      p.opportunityApplications.push({
        id: action.id,
        opportunityId: o.id,
        accountId: actor.id,
        ventureId: action.ventureId,
        motivation: text(action.motivation, 30),
        status: 'submitted',
        createdAt: now,
      });
      audit(action.id);
      break;
    }
    case 'opportunity-review': {
      const app = p.opportunityApplications.find((a) => a.id === action.id);
      const o = p.opportunities.find((o) => o.id === app?.opportunityId);
      if (!app || !o) throw new Error('Application not found.');
      if (action.status === 'withdrawn') {
        if (app.accountId !== actor.id || app.status === 'withdrawn')
          throw new Error('This application cannot be withdrawn.');
      } else {
        if (!can(actor, 'admin') && !(can(actor, 'organisation') && o.ownerId === actor.id))
          throw new Error('Only the opportunity owner can review applicants.');
        if (
          app.accountId === actor.id ||
          !['submitted', 'shortlisted'].includes(app.status) ||
          !['shortlisted', 'accepted', 'rejected'].includes(action.status)
        )
          throw new Error('Invalid application transition.');
      }
      app.status = action.status;
      audit(action.id);
      break;
    }
    case 'incubation-apply':
      require('apply');
      if (
        !p.ventures.some(
          (v) => v.id === action.ventureId && v.ownerId === actor.id && v.status === 'approved',
        )
      )
        throw new Error('Choose your approved venture.');
      if (p.incubations.some((i) => i.ventureId === action.ventureId && i.status !== 'rejected'))
        throw new Error('An incubation application already exists.');
      p.incubations.push({
        id: action.id,
        ownerId: actor.id,
        ventureId: action.ventureId,
        goal: text(action.goal, 30),
        mentorId: '',
        status: 'pending',
        milestones: [],
      });
      audit(action.id);
      break;
    case 'incubation-complete': {
      require('admin');
      const i = p.incubations.find((i) => i.id === action.id && i.status === 'active');
      if (!i || !i.milestones.length || i.milestones.some((m) => !m.validated))
        throw new Error('Complete and validate every milestone before graduating this incubation.');
      i.status = 'completed';
      audit(i.id);
      break;
    }
    case 'incubation-assign': {
      require('admin');
      const i = p.incubations.find((i) => i.id === action.id && i.status === 'pending');
      if (!i) throw new Error('Pending incubation not found.');
      if (
        action.decision === 'active' &&
        !accounts.some((a) => a.id === action.mentorId && a.role === 'mentor' && !a.suspended)
      )
        throw new Error('Choose an active mentor.');
      if (!['active', 'rejected'].includes(action.decision))
        throw new Error('Invalid incubation decision.');
      i.status = action.decision;
      i.mentorId = action.decision === 'active' ? action.mentorId : '';
      audit(i.id);
      break;
    }
    case 'milestone': {
      require('mentor');
      const i = p.incubations.find((i) => i.id === action.id && i.status === 'active');
      if (!i || (i.mentorId !== actor.id && !can(actor, 'admin')))
        throw new Error('This incubation is not assigned to you.');
      i.milestones = update(i.milestones, {
        id: action.milestoneId,
        title: text(action.title, 3, 120),
        note: text(action.note, 10),
        validated: action.validated,
      });
      audit(i.id);
      break;
    }
    case 'cms-save':
      require('cms');
      assertCmsSnapshot(action.draft.snapshot, state);
      if (!p.cmsReleases.length && action.baseline) {
        assertCmsSnapshot(action.baseline, state);
        p.cmsReleases.push({
          id: 'release-0',
          revision: 0,
          actorId: actor.id,
          title: 'Original site baseline',
          snapshot: structuredClone(action.baseline),
          createdAt: now,
        });
      }
      if (action.draft.baseRevision !== p.cmsRevision)
        throw new Error(
          'The site changed since this draft was opened. Reload the latest revision before saving.',
        );
      if (
        p.cmsDrafts.some((d) => d.id === action.draft.id && d.ownerId !== actor.id) &&
        !can(actor, 'admin')
      )
        throw new Error('This draft belongs to another editor.');
      p.cmsDrafts = update(p.cmsDrafts, {
        ...structuredClone(action.draft),
        ownerId: actor.id,
        title: text(action.draft.title, 3, 140),
        updatedAt: now,
      });
      audit(action.draft.id);
      break;
    case 'cms-publish': {
      require('cms');
      const draft = p.cmsDrafts.find((d) => d.id === action.id);
      if (!draft) throw new Error('Save a draft first.');
      if (draft.ownerId !== actor.id && !can(actor, 'admin'))
        throw new Error('This draft belongs to another editor.');
      if (draft.baseRevision !== p.cmsRevision)
        throw new Error('This draft is stale. Reload the latest site revision.');
      assertCmsSnapshot(draft.snapshot, state);
      publish(draft.snapshot, draft.title);
      p.cmsDrafts = p.cmsDrafts.filter((d) => d.id !== draft.id);
      break;
    }
    case 'cms-rollback': {
      require('cms');
      const release = p.cmsReleases.find((r) => r.revision === action.revision);
      if (!release) throw new Error('Revision is no longer retained.');
      assertCmsSnapshot(release.snapshot, state);
      publish(release.snapshot, `Restore revision ${action.revision}`);
      break;
    }
  }
  function publish(snapshot: CmsSnapshot, title: string) {
    if (snapshot.community) {
      groups = snapshot.community.groups.map((g) => ({
        ...g,
        memberIds: state.groups.find((old) => old.id === g.id)?.memberIds ?? [],
      }));
      forums = snapshot.community.forums.map((f) => ({
        ...f,
        memberIds:
          state.forums.find((old) => old.id === f.id)?.memberIds ??
          state.groups.find((g) => g.id === f.groupId)?.memberIds ??
          [],
      }));
    }
    p.courseLessons = Object.fromEntries(snapshot.catalog.courses.map((c) => [c.id, c.lessonIds]));
    p.cmsRevision++;
    p.cmsReleases = [
      ...p.cmsReleases,
      {
        id: `release-${p.cmsRevision}`,
        revision: p.cmsRevision,
        actorId: actor!.id,
        title,
        snapshot: structuredClone(snapshot),
        createdAt: now,
      },
    ].slice(-5);
    sessions = structuredClone(snapshot.sessions);
    p.opportunities = structuredClone(snapshot.opportunities);
    audit(`release-${p.cmsRevision}`);
  }
  return { ...state, accounts, sessions, forums, groups, platform: p };
}
