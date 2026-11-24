export class LaravelRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const apiOrigin = (import.meta.env?.VITE_API_URL ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${apiOrigin}/api/v1${path}`;
}

export async function laravelRequest<T>(
  path: string,
  { method = 'GET', data, signal }: { method?: string; data?: object; signal?: AbortSignal } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  const options = { credentials: 'same-origin', cache: 'no-store', signal } as const;

  async function send(url: string, init?: RequestInit) {
    let response: Response;
    try {
      response = await fetch(apiUrl(url), { ...options, ...init, headers });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new LaravelRequestError(
        'Could not reach the server. Please check your connection and try again.',
        0,
      );
    }

    if (response.status === 204) return undefined;
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = result?.errors && Object.values(result.errors).flat()[0];
      const message =
        response.status === 429
          ? 'Too many requests. Please wait a minute and try again.'
          : response.status < 500
            ? (detail ?? result?.message)
            : 'Something went wrong on our end. Please try again shortly.';
      throw new LaravelRequestError(
        typeof message === 'string' ? message : 'The request could not be completed.',
        response.status,
      );
    }
    if (!result) throw new LaravelRequestError('The server returned an unexpected response.', 502);
    return result;
  }

  if (method !== 'GET') {
    const csrf = await send('/auth/csrf');
    headers.set('X-CSRF-TOKEN', csrf.csrf_token);
  }
  const isForm = data instanceof FormData;
  if (data && !isForm) headers.set('Content-Type', 'application/json');
  const response = await send(path, {
    method,
    body: isForm ? data : data ? JSON.stringify(data) : undefined,
  });
  return response as T;
}
