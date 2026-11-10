import { createClient } from '@supabase/supabase-js';
import type { Context, Next } from 'hono';

import { config } from '../config.ts';
import { AppError } from '../errors.ts';
import type { AppVariables } from '../types.ts';

type AppEnvironment = { Variables: AppVariables };

export async function authentication(context: Context<AppEnvironment>, next: Next): Promise<void> {
  const authorization = context.req.header('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ') || authorization.length === 7) {
    throw new AppError(401, 'authentication_required');
  }

  const options = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: authorization },
    },
  };
  const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, options);
  const token = authorization.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new AppError(401, 'invalid_access_token', error);
  }

  context.set('supabase', supabase);
  context.set('user', data.user);
  await next();
}
