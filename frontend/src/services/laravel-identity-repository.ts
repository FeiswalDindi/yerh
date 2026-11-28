import type { Role } from '../domain/roles';
import { LaravelRequestError, apiUrl, laravelRequest } from './laravel-api';

export type InstitutionChoice = {
  slug: string;
  name: string;
  kind: 'high-school' | 'university' | 'hub';
  allowed_domains?: string[];
};

export interface LaravelProfile {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  location: string;
  headline: string;
  bio: string;
  email_verified: boolean;
  local_verification_available: boolean;
  has_password?: boolean;
  google_connected?: boolean;
  avatar?: string | null;
  role: Role;
  moodle_user_id?: number | null;
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
  first_name?: string;
  last_name?: string;
  password_confirmation?: string;
  terms?: boolean;
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

  async providers(signal?: AbortSignal): Promise<{ google: boolean }> {
    return (await laravelRequest<{ data: { google: boolean } }>('/auth/providers', { signal }))
      .data;
  },

  googleAuthUrl(params: {
    mode: 'login' | 'register';
    institution?: string;
    location?: string;
    redirect?: string;
  }): string {
    const query = new URLSearchParams();
    query.set('mode', params.mode);
    if (params.institution) query.set('institution', params.institution);
    if (params.location) query.set('location', params.location);
    if (params.redirect) query.set('redirect', params.redirect);
    return apiUrl(`/auth/google/redirect?${query.toString()}`);
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
    current_password?: string;
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

  async updateProfile(data: {
    first_name?: string;
    last_name?: string;
    name: string;
    location: string;
    headline: string;
    bio: string;
  }) {
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
