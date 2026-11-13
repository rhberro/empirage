import { randomUUID } from 'node:crypto';

import { config } from '../config.ts';
import type { SocketData } from './game-types.ts';

export function handleWebSocketRequest(
  request: Request,
  server: Bun.Server<unknown>,
): Response | undefined {
  const url = new globalThis.URL(request.url);
  if (url.pathname !== '/ws') {
    return undefined;
  }
  const upgradeHeader = request.headers.get('upgrade');
  if (
    request.method !== 'GET' ||
    upgradeHeader === null ||
    upgradeHeader.toLowerCase() !== 'websocket'
  ) {
    return new globalThis.Response('Upgrade Required', { status: 426 });
  }
  if (request.headers.get('origin') !== config.webOrigin) {
    return new globalThis.Response('Forbidden', { status: 403 });
  }
  const data: SocketData = {
    authenticating: false,
    id: randomUUID(),
    lastPongAt: Date.now(),
    messageCount: 0,
    messageWindowStartedAt: Date.now(),
  };
  const upgraded = server.upgrade(request, { data });
  return upgraded ? undefined : new globalThis.Response('Upgrade Failed', { status: 400 });
}
