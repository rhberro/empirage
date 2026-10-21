import { expect, test } from 'bun:test';

import { createCorsMiddleware } from '~/middleware/cors';
import { createRequestContext } from '~/router';

const CLIENT_ORIGIN = 'http://localhost:5173';
const OTHER_ORIGIN = 'http://outro.exemplo.com';
const PREFLIGHT_PATH = '/api/store/buy';

/**
 * Every header the client puts on a request.
 *
 * The list is written here by hand because the server cannot import the client:
 * a header that is missing from the list of the server is answered by the
 * preflight and then blocked by the browser, and the request never arrives.
 */
const HEADERS_THE_CLIENT_SENDS = ['Authorization', 'Content-Type', 'Idempotency-Key'];

function preflight(origin: string): Promise<{ allowed: string | null; status: number | null }> {
  const middleware = createCorsMiddleware();
  const ctx = createRequestContext();
  const request = new globalThis.Request(`http://localhost:3001${PREFLIGHT_PATH}`, {
    headers: { origin },
    method: 'OPTIONS',
  });
  return middleware(request, ctx).then(function readAnswer(response: Response | null): {
    allowed: string | null;
    status: number | null;
  } {
    return {
      allowed: ctx.responseHeaders.get('Access-Control-Allow-Headers'),
      status: response?.status ?? null,
    };
  });
}

function allowsEveryHeaderTheClientSends(): Promise<void> {
  return preflight(CLIENT_ORIGIN).then(function assertHeaders(answer): void {
    expect(answer.status).toBe(204);
    for (const header of HEADERS_THE_CLIENT_SENDS) {
      expect(answer.allowed).toContain(header);
    }
  });
}

function refusesAnUnknownOrigin(): Promise<void> {
  const middleware = createCorsMiddleware();
  const ctx = createRequestContext();
  const request = new globalThis.Request(`http://localhost:3001${PREFLIGHT_PATH}`, {
    headers: { origin: OTHER_ORIGIN },
    method: 'OPTIONS',
  });
  return middleware(request, ctx).then(function assertNoHeaders(response: Response | null): void {
    expect(ctx.responseHeaders.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response?.status).toBe(204);
  });
}

function echoesTheAllowedOrigin(): Promise<void> {
  const middleware = createCorsMiddleware();
  const ctx = createRequestContext();
  const request = new globalThis.Request(`http://localhost:3001${PREFLIGHT_PATH}`, {
    headers: { origin: CLIENT_ORIGIN },
    method: 'POST',
  });
  return middleware(request, ctx).then(function assertOrigin(response: Response | null): void {
    expect(response).toBeNull();
    expect(ctx.responseHeaders.get('Access-Control-Allow-Origin')).toBe(CLIENT_ORIGIN);
  });
}

test('the preflight allows every header the client sends', allowsEveryHeaderTheClientSends);
test('an unknown origin gets no CORS headers', refusesAnUnknownOrigin);
test('an allowed origin is echoed back', echoesTheAllowedOrigin);
