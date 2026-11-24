import type { Role } from '../domain/roles';
import { LaravelRequestError, laravelRequest } from './laravel-api';

export type InstitutionChoice = {
  slug: string;
  name: string;
  kind: 'high-school' | 'university' | 'hub';
  allowed_domains?: string[];
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
  requested_institution?: InstitutionChoice | null;
  staff: (InstitutionChoice & { access: 'manage' | 'view' })[];
}

type AccountInput = {
  email: string;
  password: string;
  institution?: string;
  location?: string;
  remember?: boolean;
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

  async forgotPassword(email: string): Promise<string> {
    return (
      await laravelRequest<{ data: { message: string } }>('/auth/forgot-password', {
        method: 'POST',
        data: { email },
      })
    ).data.message;
  },

  async resetPassword(data: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Promise<string> {
    return (
      await laravelRequest<{ data: { message: string } }>('/auth/reset-password', {
        method: 'POST',
        data,
      })
    ).data.message;
  },

  async changePassword(data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<string> {
    return (
      await laravelRequest<{ data: { message: string } }>('/auth/change-password', {
        method: 'POST',
        data,
      })
    ).data.message;
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
