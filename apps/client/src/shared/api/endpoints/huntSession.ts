import type { HuntSnapshot } from '@creatures/contracts/huntSim';

import type { ApiDeps } from '~/shared/api/client';
import { buildHeaders, isSuccessStatus, resolveErrorCode } from '~/shared/api/http';
import type { TrainerClientErrorCode } from '~/shared/api/http';

const HUNTS_PATH = '/api/hunts';
const CURRENT_HUNT_PATH = '/api/hunts/current';
const NOT_FOUND_STATUS = 404;
const UNAUTHENTICATED: TrainerClientErrorCode = 'unauthenticated';

export type HuntStartResult =
  | { ok: true; snapshot: HuntSnapshot }
  | { ok: false; code: TrainerClientErrorCode };

/**
 * Starts a hunt in the area.
 *
 * The server answers with the whole hunt, so the screen does not wait for the
 * snapshot of the channel to show the loading. Both the wrapped answer and the
 * snapshot itself are accepted: the route is being built beside this client.
 */
export function requestStartHunt(deps: ApiDeps, huntAreaId: string): Promise<HuntStartResult> {
  return deps.getAccessToken().then(buildStartRequester(deps, huntAreaId));
}

/**
 * The hunt the trainer is in, or null when there is none.
 */
export function requestCurrentHunt(deps: ApiDeps): Promise<HuntSnapshot | null> {
  return deps.getAccessToken().then(buildCurrentRequester(deps));
}

/**
 * Finalizes the hunt of the trainer.
 *
 * A hunt that is already gone counts as finalized: the route is idempotent.
 */
export function requestFinalizeHunt(deps: ApiDeps): Promise<boolean> {
  return deps.getAccessToken().then(buildFinalizeRequester(deps));
}

function buildStartRequester(
  deps: ApiDeps,
  huntAreaId: string,
): (token: string | null) => Promise<HuntStartResult> {
  return function startWithToken(token: string | null): Promise<HuntStartResult> {
    if (token === null) {
      return Promise.resolve({ code: UNAUTHENTICATED, ok: false });
    }
    const headers = buildHeaders(token);
    const body = JSON.stringify({ huntAreaId });
    const init = { body, headers, method: 'POST' };
    return globalThis
      .fetch(buildHuntsUrl(deps.baseUrl), init)
      .then(readStartResponse)
      .catch(readStartNetworkFailure);
  };
}

function buildCurrentRequester(
  deps: ApiDeps,
): (token: string | null) => Promise<HuntSnapshot | null> {
  return function readCurrentWithToken(token: string | null): Promise<HuntSnapshot | null> {
    if (token === null) {
      return Promise.resolve(null);
    }
    const headers = buildHeaders(token);
    const init = { headers, method: 'GET' };
    return globalThis
      .fetch(buildCurrentHuntUrl(deps.baseUrl), init)
      .then(readCurrentResponse)
      .catch(readCurrentNetworkFailure);
  };
}

function buildFinalizeRequester(deps: ApiDeps): (token: string | null) => Promise<boolean> {
  return function finalizeWithToken(token: string | null): Promise<boolean> {
    if (token === null) {
      return Promise.resolve(false);
    }
    const headers = buildHeaders(token);
    const init = { headers, method: 'DELETE' };
    return globalThis
      .fetch(buildCurrentHuntUrl(deps.baseUrl), init)
      .then(readFinalizeResponse)
      .catch(readFinalizeNetworkFailure);
  };
}

function readStartResponse(response: Response): Promise<HuntStartResult> {
  return response
    .json()
    .then(buildStartResult(response.status), buildUnreadableStartResult(response.status));
}

function buildStartResult(status: number): (body: unknown) => HuntStartResult {
  return function toStartResult(body: unknown): HuntStartResult {
    if (!isSuccessStatus(status)) {
      return { code: resolveErrorCode(status, body), ok: false };
    }
    const snapshot = readSnapshotBody(body);
    if (snapshot === null) {
      return { code: 'unknown', ok: false };
    }
    return { ok: true, snapshot };
  };
}

function buildUnreadableStartResult(status: number): () => HuntStartResult {
  return function toUnreadableStartResult(): HuntStartResult {
    return { code: resolveErrorCode(status, null), ok: false };
  };
}

function readStartNetworkFailure(): HuntStartResult {
  return { code: 'unknown', ok: false };
}

function readCurrentResponse(response: Response): Promise<HuntSnapshot | null> {
  if (!isSuccessStatus(response.status)) {
    return Promise.resolve(null);
  }
  return response.json().then(readCurrentBody, readCurrentUnreadable).catch(readCurrentUnreadable);
}

function readCurrentBody(body: unknown): HuntSnapshot | null {
  return readSnapshotBody(body);
}

function readCurrentUnreadable(): null {
  return null;
}

function readCurrentNetworkFailure(): null {
  return null;
}

function readFinalizeResponse(response: Response): boolean {
  return isSuccessStatus(response.status) || response.status === NOT_FOUND_STATUS;
}

function readFinalizeNetworkFailure(): boolean {
  return false;
}

function readSnapshotBody(body: unknown): HuntSnapshot | null {
  if (!isRecord(body)) {
    return null;
  }
  const snapshot = unwrapSnapshot(body);
  if (snapshot === null) {
    return null;
  }
  if (
    typeof snapshot.huntRev !== 'number' ||
    !Number.isFinite(snapshot.huntRev) ||
    !isRecord(snapshot.player) ||
    !isRecord(snapshot.session) ||
    !Array.isArray(snapshot.waves)
  ) {
    return null;
  }
  return snapshot as unknown as HuntSnapshot;
}

function unwrapSnapshot(body: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(body.hunt)) {
    return body.hunt;
  }
  if (isRecord(body.snapshot)) {
    return body.snapshot;
  }
  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildHuntsUrl(baseUrl: string): string {
  return `${baseUrl}${HUNTS_PATH}`;
}

function buildCurrentHuntUrl(baseUrl: string): string {
  return `${baseUrl}${CURRENT_HUNT_PATH}`;
}
