import process from 'node:process';

import { app } from './app.ts';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { beginGameShutdown, gameWebSocket, stopGameSimulation } from './websocket/game.ts';
import { stopHuntSimulation } from './websocket/hunting.ts';
import { handleWebSocketRequest } from './websocket/request.ts';

const SHUTDOWN_TIMEOUT_MS = 15_000;
type ShutdownSignal = 'SIGINT' | 'SIGTERM';
type PromiseResolve = (value: never) => void;
type PromiseReject = (reason?: unknown) => void;
let shutdownPromise: Promise<void> | undefined;

function fetch(
  request: Request,
  server: Bun.Server<unknown>,
): Response | Promise<Response> | undefined {
  const url = new globalThis.URL(request.url);
  const upgradeHeader = request.headers.get('upgrade');
  const isWebSocketUpgrade =
    url.pathname === '/ws' && upgradeHeader !== null && upgradeHeader.toLowerCase() === 'websocket';
  if (isWebSocketUpgrade) {
    return handleWebSocketRequest(request, server);
  }
  return app.fetch(request);
}

const serverOptions = { fetch, port: config.port, websocket: gameWebSocket };

const server = globalThis.Bun.serve(serverOptions);

const details = { port: config.port };

logger.info(details, 'server started');

async function withShutdownTimeout(operation: Promise<void>): Promise<void> {
  let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  function rejectAfterTimeout(_: PromiseResolve, reject: PromiseReject): void {
    const error = new Error(`shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms`);
    timeout = globalThis.setTimeout(reject, SHUTDOWN_TIMEOUT_MS, error);
  }
  const timeoutPromise = new Promise<never>(rejectAfterTimeout);
  const shutdownOperations = [operation, timeoutPromise];
  try {
    await Promise.race(shutdownOperations);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function isRejected(result: PromiseSettledResult<void>): result is PromiseRejectedResult {
  return result.status === 'rejected';
}

async function flushSimulations(): Promise<void> {
  const operations = [stopHuntSimulation(), stopGameSimulation()];
  const results = await Promise.allSettled(operations);
  const failed = results.find(isRejected);
  if (failed) {
    throw failed.reason;
  }
}

function logServerStopError(error: unknown): void {
  const stopDetails = { error };
  logger.error(stopDetails, 'failed to stop server connections');
}

async function shutdown(signal: ShutdownSignal): Promise<void> {
  const shutdownDetails = { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS };
  logger.info(shutdownDetails, 'server shutdown started');
  beginGameShutdown();
  server.stop(false).catch(logServerStopError);
  try {
    await withShutdownTimeout(flushSimulations());
    logger.info(shutdownDetails, 'server shutdown checkpoint completed');
  } catch (error) {
    process.exitCode = 1;
    const failureDetails = { error, signal, timeoutMs: SHUTDOWN_TIMEOUT_MS };
    logger.error(failureDetails, 'server shutdown checkpoint failed');
  } finally {
    server.stop(true).catch(logServerStopError);
  }
}

function handleShutdownSignal(signal: ShutdownSignal): void {
  shutdownPromise ??= shutdown(signal);
}

function handleSigterm(): void {
  handleShutdownSignal('SIGTERM');
}

function handleSigint(): void {
  handleShutdownSignal('SIGINT');
}

process.on('SIGTERM', handleSigterm);
process.on('SIGINT', handleSigint);
