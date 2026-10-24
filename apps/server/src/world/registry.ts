import type { Gender } from '@creatures/contracts/trainer';
import type { ActorMedia, CityMap, Direction, PathSegment, Tile } from '@creatures/contracts/world';

import { readCachedMove, writeCachedMove } from '~/world/moveCache';
import type { CachedMove } from '~/world/moveCache';
import type {
  ActorProfile,
  MoveOutcome,
  StepConfirmation,
  WorldRegistry,
  WorldRegistryOptions,
} from '~/world/registryTypes';

export { MOVE_CACHE_TTL_MS } from '~/world/moveCache';

export type {
  ActorProfile,
  ActorStart,
  MoveOutcome,
  StepConfirmation,
  WorldRegistry,
  WorldRegistryOptions,
} from '~/world/registryTypes';

type ActorRecord = {
  actorId: string;
  dir: Direction;
  gender: Gender;
  name: string;
  position: Tile;
  present: boolean;
  segments: PathSegment[];
  trainerId: string;
};

type WorldState = {
  clock: () => number;
  map: CityMap;
  moves: Map<string, CachedMove>;
  onStepConfirmed?: (confirmation: StepConfirmation) => void;
  records: Map<string, ActorRecord>;
  revisions: Map<string, number>;
};

/**
 * The state of the world in the memory of the process.
 *
 * The durable copy lives in `trainer_positions`; this registry is the fast
 * path while the process lives, and the clock is the source of truth.
 */
export function createWorldRegistry(map: CityMap, options?: WorldRegistryOptions): WorldRegistry {
  const state: WorldState = {
    clock: options?.now ?? Date.now,
    map,
    moves: new Map<string, CachedMove>(),
    onStepConfirmed: options?.onStepConfirmed,
    records: new Map<string, ActorRecord>(),
    revisions: new Map<string, number>(),
  };
  return buildRegistry(state);
}

function buildRegistry(state: WorldState): WorldRegistry {
  return {
    actor(userId: string, at: number): ActorMedia | undefined {
      return advanceActor(state, userId, at);
    },
    actors(at: number, exceptId?: string): ActorMedia[] {
      return listActors(state, at, exceptId);
    },
    advance(userId: string, at: number): ActorMedia | undefined {
      return advanceActor(state, userId, at);
    },
    cacheMove(userId: string, reqId: string, outcome: MoveOutcome, at: number): void {
      writeCachedMove(state.moves, userId, reqId, outcome, at);
    },
    completeStep(userId: string, at: number): ActorMedia | undefined {
      return completeActorStep(state, userId, at);
    },
    join(userId: string, profile: ActorProfile, at: number): ActorMedia {
      return joinActor(state, userId, profile, at);
    },
    leave(userId: string, at: number): boolean {
      return leaveActor(state, userId, at);
    },
    nextWorldRev(observerId: string): number {
      return nextRevision(state, observerId);
    },
    now(): number {
      return state.clock();
    },
    presentIds(): string[] {
      return presentActorIds(state);
    },
    readCachedMove(userId: string, reqId: string, at: number): MoveOutcome | undefined {
      return readCachedMove(state.moves, userId, reqId, at);
    },
    setPath(userId: string, path: PathSegment[], at: number): void {
      writePath(state, userId, path, at);
    },
    trainerId(userId: string): string | undefined {
      return state.records.get(userId)?.trainerId;
    },
  };
}

function joinActor(
  state: WorldState,
  userId: string,
  profile: ActorProfile,
  at: number,
): ActorMedia {
  const known = state.records.get(userId);
  if (known === undefined) {
    const start = profile.start;
    const record: ActorRecord = {
      actorId: userId,
      dir: start?.facing ?? 'down',
      gender: profile.gender,
      name: profile.name,
      position:
        start === undefined
          ? { x: state.map.spawn.x, y: state.map.spawn.y }
          : { x: start.x, y: start.y },
      present: true,
      segments: [],
      trainerId: profile.trainerId,
    };
    state.records.set(userId, record);
    return toMedia(record);
  }
  known.gender = profile.gender;
  known.name = profile.name;
  known.trainerId = profile.trainerId;
  known.present = true;
  if (profile.start === undefined) {
    advanceRecord(state, known, at);
  } else {
    known.position = { x: profile.start.x, y: profile.start.y };
    known.dir = profile.start.facing;
  }
  // A fresh connection starts from the durable tile: a path planned before
  // the reconnect belongs to a connection that no longer exists.
  known.segments = [];
  return toMedia(known);
}

/** The disconnect path: land on the square the trainer was entering. */
function completeActorStep(state: WorldState, userId: string, at: number): ActorMedia | undefined {
  const record = state.records.get(userId);
  if (record === undefined || !record.present) {
    return undefined;
  }
  advanceRecord(state, record, at);
  const [segment] = record.segments;
  if (segment !== undefined) {
    record.position = { x: segment.to.x, y: segment.to.y };
    record.dir = segment.dir;
    record.segments = [];
    confirmStep(state, record);
  }
  return toMedia(record);
}

function leaveActor(state: WorldState, userId: string, at: number): boolean {
  const record = state.records.get(userId);
  if (record === undefined) {
    return false;
  }
  advanceRecord(state, record, at);
  const wasPresent = record.present;
  record.present = false;
  record.segments = [];
  return wasPresent;
}

function advanceActor(state: WorldState, userId: string, at: number): ActorMedia | undefined {
  const record = state.records.get(userId);
  if (record === undefined || !record.present) {
    return undefined;
  }
  advanceRecord(state, record, at);
  return toMedia(record);
}

function listActors(state: WorldState, at: number, exceptId?: string): ActorMedia[] {
  const visible: ActorMedia[] = [];
  for (const record of state.records.values()) {
    if (!record.present || record.actorId === exceptId) {
      continue;
    }
    advanceRecord(state, record, at);
    visible.push(toMedia(record));
  }
  return visible;
}

function presentActorIds(state: WorldState): string[] {
  const ids: string[] = [];
  for (const record of state.records.values()) {
    if (record.present) {
      ids.push(record.actorId);
    }
  }
  return ids;
}

function writePath(state: WorldState, userId: string, path: PathSegment[], at: number): void {
  const record = state.records.get(userId);
  if (record === undefined) {
    return;
  }
  advanceRecord(state, record, at);
  record.segments = path.slice();
  const [first] = path;
  if (first !== undefined) {
    record.dir = first.dir;
  }
}

function nextRevision(state: WorldState, observerId: string): number {
  const rev = (state.revisions.get(observerId) ?? 0) + 1;
  state.revisions.set(observerId, rev);
  return rev;
}

function advanceRecord(state: WorldState, record: ActorRecord, at: number): void {
  let [segment] = record.segments;
  while (segment !== undefined && segment.endsAt <= at) {
    record.position = { x: segment.to.x, y: segment.to.y };
    record.dir = segment.dir;
    record.segments.shift();
    confirmStep(state, record);
    [segment] = record.segments;
  }
}

function confirmStep(state: WorldState, record: ActorRecord): void {
  state.onStepConfirmed?.({
    actorId: record.actorId,
    dir: record.dir,
    position: { x: record.position.x, y: record.position.y },
    trainerId: record.trainerId,
  });
}

function toMedia(record: ActorRecord): ActorMedia {
  const media: ActorMedia = {
    actorId: record.actorId,
    dir: record.dir,
    gender: record.gender,
    name: record.name,
    position: record.position,
  };
  const [segment] = record.segments;
  if (segment !== undefined) {
    media.segment = segment;
  }
  return media;
}
