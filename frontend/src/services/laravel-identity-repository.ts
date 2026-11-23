import type { Role } from '../domain/roles';
import { LaravelRequestError, laravelRequest } from './laravel-api';

export type InstitutionChoice = {
  slug: string;
  name: string;
  kind: 'high-school' | 'university' | 'hub';
};

export interface LaravelProfile {
  id: number;
  name: string;
  email: string;
  location: string;
  headline: string;
  bio: string;
  email_verified: boolean;
  local_verification_available: boolean;
  role: Role;
  affiliation: (InstitutionChoice & { status: string }) | null;
  staff: (InstitutionChoice & { access: 'manage' | 'view' })[];
}

type AccountInput = {
  email: string;
  password: string;
  institution?: string;
  name?: string;
  password_confirmation?: string;
};

export const localLaravelIdentity = {
  async profile(signal?: AbortSignal): Promise<LaravelProfile | null> {
    try {
      return (await laravelRequest<{ data: LaravelProfile }>('/auth/me', { signal })).data;
    } catch (error) {
      if (error instanceof LaravelRequestError && error.status === 401) return null;
      throw error;
    }
  },

  async authenticate(mode: 'login' | 'register', data: AccountInput): Promise<LaravelProfile> {
    return (
      await laravelRequest<{ data: LaravelProfile }>('/auth/' + mode, { method: 'POST', data })
    ).data;
  },

  async choices(signal?: AbortSignal): Promise<InstitutionChoice[]> {
    return (await laravelRequest<{ data: InstitutionChoice[] }>('/institutions', { signal })).data;
  },

  async updateProfile(data: Pick<LaravelProfile, 'name' | 'location' | 'headline' | 'bio'>) {
    await laravelRequest('/auth/me', { method: 'PATCH', data });
  },
  async logout(): Promise<void> {
    await laravelRequest('/auth/logout', { method: 'POST' });
  },

  async localVerificationLink(): Promise<string> {
    return (
      await laravelRequest<{ data: { url: string } }>('/auth/verify-email/local-link', {
        method: 'POST',
      })
    ).data.url;
  },

  async resendVerification(): Promise<void> {
    await laravelRequest('/auth/verify-email/resend', { method: 'POST' });
  },
};
