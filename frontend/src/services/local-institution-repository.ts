import { apiUrl, laravelRequest } from './laravel-api';

type Scope = { institution: string; access: 'view' | 'manage' };
type Accepted = { institution: string; role: 'entrepreneur' };
export type InvitationPreview = {
  invitee_name: string;
  institution_name: string;
  institution_slug: string;
  valid: boolean;
  expired: boolean;
  accepted: boolean;
  revoked: boolean;
};

async function read<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) throw new Error('Please sign in first.');
    if (res.status === 403) throw new Error('This account cannot perform that institution action.');
    if (res.status === 404)
      throw new Error('No matching active institution or invitation was found.');
    if (res.status === 429) throw new Error('Too many requests. Wait one minute and try again.');
    const problem = body?.errors && Object.values(body.errors).flat()[0];
    throw new Error(
      typeof problem === 'string' ? problem : 'This institution action could not be completed.',
    );
  }

  if (!body) throw new Error('The server returned an unexpected response.');
  return body as T;
}

async function request(path: string, method = 'GET', body?: object) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    const response = await fetch(apiUrl('/auth/csrf'), {
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    headers['X-CSRF-TOKEN'] = (await read<{ csrf_token: string }>(response)).csrf_token;
  }

  if (body) headers['Content-Type'] = 'application/json';
  return fetch(apiUrl('/identity' + path), {
    headers,
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  });
}

const scopePath = (slug: string) => '/institutions/' + encodeURIComponent(slug);

export const localInstitution = {
  async preview(token: string, signal?: AbortSignal): Promise<InvitationPreview> {
    return (
      await laravelRequest<{ data: InvitationPreview }>(
        '/identity/invitations/preview/' + encodeURIComponent(token),
        { signal },
      )
    ).data;
  },
  async candidates(slug: string, q: string, signal: AbortSignal) {
    return (
      await laravelRequest<{ data: { id: number; name: string }[] }>(
        '/identity' + scopePath(slug) + '/invitees?' + new URLSearchParams({ q }),
        { signal },
      )
    ).data;
  },
  async inviteMembers(slug: string, user_ids: number[]) {
    return laravelRequest('/identity' + scopePath(slug) + '/invitations', {
      method: 'POST',
      data: { user_ids },
    });
  },
  async access(slug: string): Promise<Scope> {
    return (await read<{ data: Scope }>(await request(scopePath(slug) + '/access'))).data;
  },

  async issue(slug: string, body: { name: string; email: string }): Promise<number> {
    const response = await request(scopePath(slug) + '/invitations', 'POST', body);
    return (await read<{ data: { id: number } }>(response)).data.id;
  },

  async revoke(slug: string, id: string): Promise<void> {
    const response = await request(
      scopePath(slug) + '/invitations/' + encodeURIComponent(id),
      'DELETE',
    );
    if (response.status !== 204) await read(response);
  },

  async accept(token: string, location: string, consent: boolean): Promise<Accepted> {
    const response = await request('/invitations/accept', 'POST', { token, location, consent });
    return (await read<{ data: Accepted }>(response)).data;
  },
};
