import { URL } from 'node:url';

import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { BlankEnv, BlankInput } from 'hono/types';
import { ContentfulStatusCode } from 'hono/utils/http-status';

import { config } from './config.ts';
import { AppError } from './errors.ts';
import { logger } from './logger.ts';
import { requestLogging } from './middleware/request-logging.ts';
import { characters } from './routes/characters.ts';

export const app = new Hono();

function isDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const isLoopbackHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isHttpProtocol = url.protocol === 'http:';
    return isLoopbackHost && isHttpProtocol;
  } catch {
    return false;
  }
}

function corsOrigin(origin: string): string | undefined {
  return origin === config.webOrigin || isDevelopmentOrigin(origin) ? origin : undefined;
}

const corsOptions = {
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  origin: corsOrigin,
};
const corsMiddleware = cors(corsOptions);

app.use('*', corsMiddleware);

function notFound(context: Context): Response {
  const response = { code: 'not_found', message: 'not_found' };
  return context.json(response, 404);
}

app.notFound(notFound);

function onError(error: Error, context: Context): Response {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      const details = { cause: error.cause, code: error.code, error };
      logger.error(details, 'request failed');
    }

    const response = { code: error.code, message: error.message };
    return context.json(response, error.status as ContentfulStatusCode);
  }

  const details = { error };
  logger.error(details, 'unhandled request error');
  const response = { code: 'internal_server_error', message: 'internal_server_error' };
  return context.json(response, 500);
}

app.onError(onError);

app.use('*', requestLogging);

function health(context: Context<BlankEnv, '/health', BlankInput>): Response {
  const response = { status: 'ok' };
  return context.json(response);
}

app.get('/health', health);

app.route('/characters', characters);
