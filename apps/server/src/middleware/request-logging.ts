import { performance } from 'node:perf_hooks';

import type { Context, Next } from 'hono';

import { logger } from '../logger.ts';

export async function requestLogging(context: Context, next: Next): Promise<void> {
  const startedAt = performance.now();

  await next();

  const details = {
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    method: context.req.method,
    path: context.req.path,
    status: context.res.status,
  };
  logger.info(details, 'request completed');
}
