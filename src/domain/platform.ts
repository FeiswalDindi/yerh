import type { Catalog } from './content';
import type { CommunitySession } from './community';
import type { AppliedRole, Role } from './roles';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export interface RoleApplication {
  id: string;
  accountId: string;
  role: AppliedRole;
  motivation: string;
  organisation: string;
  expertise: string;
  status: ReviewStatus;
  createdAt: string;
  reviewedBy?: string;
  reason?: string;
}
export interface Opportunity {
  id: string;
  slug: string;
  ownerId: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  organiser: string;
  type: 'internal' | 'external';
  mode: 'online' | 'in_person' | 'hybrid';
  location: string;
  sectors: string[];
  stages: string[];
  eligibility: string;
  benefits: string;
  documents: string[];
  opensAt: string | null;
  deadline: string | null;
  rolling: boolean;
  externalUrl: string;
  status: 'draft' | 'review' | 'published' | 'closed' | 'archived';
  featured: boolean;
  image: string;
  capacity: number | null;
  publishedAt: string | null;
}
export interface OpportunityApplication {
  id: string;
  opportunityId: string;
  accountId: string;
  ventureId: string;
  motivation: string;
  status: 'submitted' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
}
export interface Venture {
  id: string;
  ownerId: string;
  name: string;
  sector: string;
  stage: string;
  description: string;
  location: string;
  status: ReviewStatus;
}
export interface Product {
  id: string;
  ventureId: string;
  ownerId: string;
  name: string;
  description: string;
  price: number;
  status: ReviewStatus;
}
export interface Incubation {
  id: string;
  ownerId: string;
  ventureId: string;
  goal: string;
  mentorId: string;
  status: 'pending' | 'active' | 'completed' | 'rejected';
  milestones: { id: string; title: string; note: string; validated: boolean }[];
}
export interface MentorProfile {
  accountId: string;
  expertise: string;
  availability: string;
  bio: string;
}
export interface Organisation {
  accountId: string;
  name: string;
  type: string;
  sectors: string;
  contact: string;
  website: string;
  status: ReviewStatus;
}
export interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  createdAt: string;
}
export interface CmsSnapshot {
  community?: {
    forums: { id: string; name: string; description: string; groupId?: string }[];
    groups: { id: string; name: string; description: string; category: string }[];
  };
  catalog: Catalog;
  sessions: CommunitySession[];
  opportunities: Opportunity[];
}
export interface CmsDraft {
  id: string;
  ownerId: string;
  title: string;
  baseRevision: number;
  snapshot: CmsSnapshot;
  updatedAt: string;
}
export interface CmsRelease {
  id: string;
  revision: number;
  actorId: string;
  title: string;
  snapshot: CmsSnapshot;
  createdAt: string;
}
export interface PlatformState {
  certificates: {
    id: string;
    accountId: string;
    courseId: string;
    issuedAt: string;
    issuedBy: string;
  }[];
  courseLessons: Record<string, string[]>;
  applications: RoleApplication[];
  opportunities: Opportunity[];
  opportunityApplications: OpportunityApplication[];
  ventures: Venture[];
  products: Product[];
  incubations: Incubation[];
  mentors: MentorProfile[];
  organisations: Organisation[];
  enrollments: Record<string, string[]>;
  audit: AuditEntry[];
  cmsDrafts: CmsDraft[];
  cmsReleases: CmsRelease[];
  cmsRevision: number;
}
export type PlatformAction =
  | { type: 'certificate-issue'; id: string; accountId: string; courseId: string; now: string }
  | {
      type: 'signup';
      id: string;
      name: string;
      email: string;
      location: string;
      phone: string;
      ageRange: string;
      consent: boolean;
      now: string;
    }
  | {
      type: 'role-apply';
      id: string;
      role: AppliedRole;
      motivation: string;
      organisation: string;
      expertise: string;
      now: string;
    }
  | {
      type: 'role-review';
      id: string;
      decision: 'approved' | 'rejected';
      reason: string;
      now: string;
    }
  | { type: 'account-admin'; accountId: string; role?: Role; suspended?: boolean; now: string }
  | { type: 'enroll'; courseId: string; operation: 'enroll' | 'withdraw'; now: string }
  | { type: 'venture-save'; venture: Venture; now: string }
  | { type: 'product-save'; product: Product; now: string }
  | {
      type: 'venture-review';
      id: string;
      entity: 'venture' | 'product' | 'organisation';
      decision: ReviewStatus;
      now: string;
    }
  | { type: 'mentor-profile'; profile: MentorProfile; now: string }
  | { type: 'organisation-save'; organisation: Organisation; now: string }
  | { type: 'opportunity-save'; opportunity: Opportunity; now: string }
  | { type: 'opportunity-status'; id: string; status: Opportunity['status']; now: string }
  | {
      type: 'opportunity-apply';
      id: string;
      opportunityId: string;
      ventureId: string;
      motivation: string;
      now: string;
    }
  | {
      type: 'opportunity-review';
      id: string;
      status: OpportunityApplication['status'];
      now: string;
    }
  | { type: 'incubation-apply'; id: string; ventureId: string; goal: string; now: string }
  | { type: 'incubation-complete'; id: string; now: string }
  | {
      type: 'incubation-assign';
      id: string;
      mentorId: string;
      decision: 'active' | 'rejected';
      now: string;
    }
  | {
      type: 'milestone';
      id: string;
      milestoneId: string;
      title: string;
      note: string;
      validated: boolean;
      now: string;
    }
  | { type: 'cms-save'; draft: CmsDraft; baseline?: CmsSnapshot; now: string }
  | { type: 'cms-publish'; id: string; now: string }
  | { type: 'cms-rollback'; revision: number; now: string };
