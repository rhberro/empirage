import { env } from 'node:process';
import { URL } from 'node:url';

type Config = {
  port: number;
  supabasePublishableKey: string;
  supabaseUrl: string;
  webOrigin: string;
};

function requiredEnvironmentVariable(name: string): string {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function serverPort(): number {
  const value = env.PORT;
  const port = value ? Number(value) : 3001;

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be a valid TCP port');
  }

  return port;
}

function webOrigin(): string {
  const value = env.WEB_ORIGIN ?? 'http://localhost:5173';
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('WEB_ORIGIN must be a valid URL origin');
  }

  const hasUnsupportedParts =
    url.pathname !== '/' || Boolean(url.search || url.hash || url.username || url.password);
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || hasUnsupportedParts) {
    throw new Error('WEB_ORIGIN must be an HTTP or HTTPS origin without a path');
  }

  return url.origin;
}

export const config: Config = {
  port: serverPort(),
  supabasePublishableKey: requiredEnvironmentVariable('SUPABASE_PUBLISHABLE_KEY'),
  supabaseUrl: requiredEnvironmentVariable('SUPABASE_URL'),
  webOrigin: webOrigin(),
};
