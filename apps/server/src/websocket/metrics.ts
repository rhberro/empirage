import { logger } from '../logger.ts';

type MessageMetrics = { bytes: number; count: number };
type MessageMetricsByType = Map<string, MessageMetrics>;

const METRICS_INTERVAL_MS = 60_000;
const received = new Map<string, MessageMetrics>();
const sent = new Map<string, MessageMetrics>();
let activeConnections = 0;
let backpressureDrops = 0;
let closedConnections = 0;

function record(byType: MessageMetricsByType, type: string, bytes: number): void {
  const current = byType.get(type) ?? { bytes: 0, count: 0 };
  current.bytes += bytes;
  current.count += 1;
  byType.set(type, current);
}

function serializableMetrics(byType: MessageMetricsByType): Record<string, MessageMetrics> {
  return Object.fromEntries(byType);
}

export function recordWebSocketReceived(type: string, bytes: number): void {
  record(received, type, bytes);
}

export function recordWebSocketSent(type: string, bytes: number): void {
  record(sent, type, bytes);
}

export function recordWebSocketConnectionOpened(): void {
  activeConnections += 1;
}

export function recordWebSocketConnectionClosed(): void {
  activeConnections = Math.max(0, activeConnections - 1);
  closedConnections += 1;
}

export function recordWebSocketBackpressureDrop(): void {
  backpressureDrops += 1;
}

function flushWebSocketMetrics(): void {
  if (
    received.size === 0 &&
    sent.size === 0 &&
    closedConnections === 0 &&
    backpressureDrops === 0
  ) {
    return;
  }
  const details = {
    activeConnections,
    backpressureDrops,
    closedConnections,
    received: serializableMetrics(received),
    sent: serializableMetrics(sent),
  };
  logger.info(details, 'websocket metrics');
  received.clear();
  sent.clear();
  backpressureDrops = 0;
  closedConnections = 0;
}

const metricsTimer = globalThis.setInterval(flushWebSocketMetrics, METRICS_INTERVAL_MS);

export function stopWebSocketMetrics(): void {
  globalThis.clearInterval(metricsTimer);
  flushWebSocketMetrics();
}
