import type { Middleware, RequestContext } from '~/router';

const DEV_ORIGIN = 'http://localhost:5173';
/**
 * The headers the client is allowed to send.
 *
 * The list has to carry every header the client puts on a request: a header
 * that is missing here is answered by the preflight and then blocked by the
 * browser, and the request never reaches the server.
 */
const ALLOWED_HEADERS = 'Authorization, Content-Type, Idempotency-Key';
const ALLOWED_METHODS = 'DELETE, GET, PATCH, POST, PUT, OPTIONS';
const NO_CONTENT = 204;

export function createCorsMiddleware(clientOrigin?: string): Middleware {
  const allowedOrigins = buildAllowedOrigins(clientOrigin);
  return function applyCors(req, ctx): Promise<Response | null> {
    applyCorsHeaders(req, ctx, allowedOrigins);
    if (req.method === 'OPTIONS') {
      const init = { headers: ctx.responseHeaders, status: NO_CONTENT };
      return Promise.resolve(new globalThis.Response(null, init));
    }
    return Promise.resolve(null);
  };
}

function applyCorsHeaders(req: Request, ctx: RequestContext, allowedOrigins: Set<string>): void {
  const origin = req.headers.get('origin');
  if (origin === null || !allowedOrigins.has(origin)) {
    return;
  }
  ctx.responseHeaders.set('Access-Control-Allow-Origin', origin);
  ctx.responseHeaders.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  ctx.responseHeaders.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  ctx.responseHeaders.set('Vary', 'Origin');
}

function buildAllowedOrigins(clientOrigin: string | undefined): Set<string> {
  const origins = [DEV_ORIGIN];
  if (clientOrigin !== undefined && clientOrigin !== '') {
    origins.push(clientOrigin);
  }
  return new Set(origins);
}
