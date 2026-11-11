import { supabase } from './supabase';

type ApiErrorPayload = Partial<{
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
}>;

export class ApiError extends Error {
  public readonly code: string;
  public readonly details: string | null;
  public readonly hint: string | null;
  public readonly status: number;

  public constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.code = payload.code ?? String(status);
    this.details = payload.details ?? null;
    this.hint = payload.hint ?? null;
    this.status = status;
  }
}

async function getErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    const error = await response.json();
    return error as ApiErrorPayload;
  } catch {
    return { message: response.statusText };
  }
}

async function getAuthorizationHeader(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session ? 'Bearer ' + data.session.access_token : null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const authorization = await getAuthorizationHeader();
  const initialHeaders = init ? init.headers : undefined;
  const headers = new globalThis.Headers(initialHeaders);
  if (authorization) {
    headers.set('Authorization', authorization);
  }
  if (init && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const requestInit: RequestInit = { ...init, headers };
  const response = await globalThis.fetch(API_BASE_URL + path, requestInit);
  if (!response.ok) {
    const payload = await getErrorPayload(response);
    throw new ApiError(response.status, payload);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const json = await response.json();
  return json as T;
}
