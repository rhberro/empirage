import { randomUUID } from 'node:crypto';

import { config, isAllowedWebOrigin } from '../config.ts';
import type { SocketData } from './game-types.ts';
import { recordWebSocketConnectionOpened } from './metrics.ts';

const connectionsByIpAddress = new Map<string, number>();

function hasConnectionCapacity(ipAddress: string): boolean {
  const current = connectionsByIpAddress.get(ipAddress) ?? 0;
  return current < config.websocketMaximumConnectionsPerIp;
}

function reserveConnection(ipAddress: string): void {
  const current = connectionsByIpAddress.get(ipAddress) ?? 0;
  connectionsByIpAddress.set(ipAddress, current + 1);
}

export function releaseWebSocketConnection(ipAddress: string): void {
  const current = connectionsByIpAddress.get(ipAddress);
  if (!current || current === 1) {
    connectionsByIpAddress.delete(ipAddress);
    return;
  }
  connectionsByIpAddress.set(ipAddress, current - 1);
}

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
  if (!isAllowedWebOrigin(request.headers.get('origin'))) {
    return new globalThis.Response('Forbidden', { status: 403 });
  }
  const remoteAddress = server.requestIP(request);
  if (!remoteAddress) {
    return new globalThis.Response('Unable to determine client address', { status: 403 });
  }
  const ipAddress = remoteAddress.address;
  if (!hasConnectionCapacity(ipAddress)) {
    return new globalThis.Response('Too Many Connections', { status: 429 });
  }
  const data: SocketData = {
    authenticating: false,
    id: randomUUID(),
    ipAddress,
    lastPongAt: Date.now(),
    messageCount: 0,
    messageWindowStartedAt: Date.now(),
  };
  const upgraded = server.upgrade(request, { data });
  if (!upgraded) {
    return new globalThis.Response('Upgrade Failed', { status: 400 });
  }
  reserveConnection(ipAddress);
  recordWebSocketConnectionOpened();
  return undefined;
}
