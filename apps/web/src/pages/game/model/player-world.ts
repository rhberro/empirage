import type {
  AuthenticatedEvent,
  MovementStartedEvent,
  PlayerIdleEvent,
  PlayerJoinedEvent,
  PlayerState,
  SnapshotEvent,
} from '../api/game-protocol';

export type WorldPlayer = PlayerState & {
  direction: PlayerIdleEvent['direction'];
  mode: PlayerIdleEvent['mode'];
};

export class PlayerWorld {
  private readonly players = new Map<string, WorldPlayer>();

  public values(): IterableIterator<WorldPlayer> {
    return this.players.values();
  }

  public has(characterId: string): boolean {
    return this.players.has(characterId);
  }

  public applyAuthenticated(event: AuthenticatedEvent): void {
    const state = { characterId: event.characterId, movement: null, tick: 0, tile: event.position };
    this.applyPlayer(state);
  }

  public applySnapshot(event: SnapshotEvent): void {
    const present = new Set<string>();
    for (const player of event.players) {
      present.add(player.characterId);
      this.applyPlayer(player);
    }
    for (const [id, player] of this.players) {
      if (!present.has(id) && player.tick <= event.tick) {
        this.players.delete(id);
      }
    }
  }

  public applyMovement(event: MovementStartedEvent): void {
    const current = this.players.get(event.characterId);
    if (current && event.tick < current.tick) {
      return;
    }
    const tile = event.movement.from;
    const state = {
      characterId: event.characterId,
      movement: event.movement,
      tick: event.tick,
      tile,
    };
    this.applyPlayer(state);
  }

  public applyPresence(event: PlayerIdleEvent | PlayerJoinedEvent): void {
    const current = this.players.get(event.characterId);
    if (current && event.tick < current.tick) {
      return;
    }
    const player = {
      characterId: event.characterId,
      direction: event.direction,
      mode: event.mode,
      movement: null,
      tick: event.tick,
      tile: event.position,
    };
    this.players.set(event.characterId, player);
  }

  public remove(characterId: string, tick: number): void {
    const current = this.players.get(characterId);
    if (!current || tick >= current.tick) {
      this.players.delete(characterId);
    }
  }

  private applyPlayer(state: PlayerState): void {
    const current = this.players.get(state.characterId);
    if (current && state.tick < current.tick) {
      return;
    }
    const movement = resolveMovement(current, state);
    const direction = movement ? directionFor(movement) : current ? current.direction : 'south';
    const mode = movement ? movement.mode : current ? current.mode : 'walking';
    const player = { ...state, direction, mode, movement };
    this.players.set(state.characterId, player);
  }
}

function resolveMovement(
  current: WorldPlayer | undefined,
  state: PlayerState,
): PlayerState['movement'] {
  if (!current || !current.movement) {
    return state.movement;
  }
  if (state.movement && state.movement.id === current.movement.id) {
    return current.movement;
  }
  if (!state.movement && state.tick === current.tick) {
    return current.movement;
  }
  return state.movement;
}

function directionFor(movement: NonNullable<PlayerState['movement']>): WorldPlayer['direction'] {
  const dx = movement.to.x - movement.from.x;
  const dy = movement.to.y - movement.from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  }
  return dy > 0 ? 'south' : 'north';
}
