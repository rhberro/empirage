import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config.ts';
import type { ClientMessage } from './game-types.ts';

export function parseMessage(rawMessage: string | Buffer): ClientMessage | undefined {
  try {
    const text = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString('utf8');
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as ClientMessage) : undefined;
  } catch {
    return undefined;
  }
}

export function createAuthenticatedClient(token: string): SupabaseClient {
  const options = {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  };
  return createClient(config.supabaseUrl, config.supabasePublishableKey, options);
}

export function createServerClient(): SupabaseClient {
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  return createClient(config.supabaseUrl, config.supabaseSecretKey, options);
}
