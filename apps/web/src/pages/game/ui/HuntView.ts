import type { GameObjects, Scene } from 'phaser';
/* eslint-disable max-lines */

import type { Tile } from '../api/game-protocol';
import type { HuntCommand, HuntGrid, HuntState } from '../api/hunt-protocol';
import { CREATURE_ALLY_KEY, HuntCreatures } from './hunt-creatures';
import type { CreatureSpec } from './hunt-creatures';
import { HuntEffects } from './hunt-effects';

type CommandSender = (command: HuntCommand) => boolean;
type CameraFocusHandler = (target: Tile | null) => void;

const PLAYER_ATLAS_KEY = 'male-walking-running';
const PLAYER_FRAME = 'idle/east/frame_1';
const ALLY_DIRECTION = 'east';
const ENEMY_DIRECTION = 'west';
const ENEMY_KEY_PREFIX = 'enemy-';
const BACKDROP_COLOR = 0x2b2e37;
const BLOCKED_TILE_COLOR = 0x54585f;
const GRID_BORDER_COLOR = 0x1c1e26;
const MAXIMUM_RETIRED_HUNTS = 128;
const STATUS_STYLE = {
  backgroundColor: '#191b24',
  color: '#ffffff',
  fontFamily: 'monospace',
  fontSize: '12px',
  padding: { x: 8, y: 6 },
  wordWrap: { width: 288 },
};

function tileKey(tile: Tile): string {
  return `${tile.x},${tile.y}`;
}

export class HuntView {
  public active = false;
  public pending = false;
  public connected = false;
  private readonly backdrop: GameObjects.Container;
  private readonly overlay: GameObjects.Container;
  private readonly scene: Scene;
  private readonly send: CommandSender;
  private readonly focusCamera: CameraFocusHandler;
  private readonly status: GameObjects.Text;
  private readonly creatures: HuntCreatures;
  private readonly effects: HuntEffects;
  private state: HuntState | null = null;
  private connectionMessage = 'Conectando…';
  private gridOriginX = 0;
  private gridOriginY = 0;
  private tileSize = 16;
  private player: GameObjects.Sprite | null = null;
  private backdropKey = '';
  private clockOffset = 0;
  private clockReady = false;
  private lastServerNow = 0;
  private bestClockRtt = Number.POSITIVE_INFINITY;
  private clockSynchronized = false;
  private readonly retiredHunts = new Set<string>();
  private combatEventCutoff = 0;
  public constructor(scene: Scene, send: CommandSender, focusCamera: CameraFocusHandler) {
    this.scene = scene;
    this.send = send;
    this.focusCamera = focusCamera;
    this.backdrop = scene.add.container(0, 0).setDepth(9_999).setScrollFactor(0);
    this.overlay = scene.add.container(0, 0).setDepth(10_000).setScrollFactor(0);
    this.effects = new HuntEffects(scene);
    this.status = scene.add
      .text(8, 8, 'Conectando…', STATUS_STYLE)
      .setDepth(20_000)
      .setScrollFactor(0);
    this.creatures = new HuntCreatures(scene, this.overlay, this.redraw.bind(this));
    scene.scale.on('resize', this.redraw, this);
    scene.events.once('shutdown', this.destroy, this);
  }

  public request(event: KeyboardEvent): void {
    if (event.repeat || this.pending || !this.connected) {
      return;
    }
    const command: HuntCommand = { type: this.active ? 'leave_hunt' : 'start_hunt', version: 1 };
    if (this.send(command)) {
      this.pending = true;
      this.status.setText(this.active ? 'Voltando à cidade…' : 'Preparando caça…').setVisible(true);
    } else {
      this.disconnect();
    }
  }

  // Applying a hunt snapshot coordinates stale filtering, clocking, transitions, and rendering.
  // eslint-disable-next-line complexity, max-lines-per-function
  public apply(state: HuntState | null, endedHuntId?: string): void {
    if (!state) {
      if (endedHuntId) {
        this.retireHunt(endedHuntId);
      }
      if (endedHuntId && this.state && endedHuntId !== this.state.huntId) {
        return;
      }
    }
    if (state && this.retiredHunts.has(state.huntId)) {
      return;
    }
    const changedRuntime = Boolean(
      state &&
      this.state &&
      state.huntId === this.state.huntId &&
      state.runtimeGeneration &&
      state.runtimeGeneration !== this.state.runtimeGeneration,
    );
    // Same runtime with an equal or older revision is a delayed duplicate, not new information.
    if (
      state &&
      this.state &&
      state.huntId === this.state.huntId &&
      !changedRuntime &&
      state.revision <= this.state.revision
    ) {
      return;
    }
    const wasActive = this.active;
    const changedHunt = Boolean(state && this.state && state.huntId !== this.state.huntId);
    if (changedHunt || changedRuntime) {
      if (this.state && changedHunt) {
        this.retireHunt(this.state.huntId);
      }
      this.creatures.reset();
      this.effects.clear();
      this.clockReady = false;
      this.clockSynchronized = false;
      this.bestClockRtt = Number.POSITIVE_INFINITY;
      this.lastServerNow = 0;
      this.combatEventCutoff = changedRuntime && state ? HuntView.recoveryCutoff(state) : 0;
    }
    const receivedAt = Date.now();
    if (state && state.serverTime !== undefined) {
      this.observeServerTime(state.serverTime, receivedAt);
    }
    let now = this.serverNow(receivedAt);
    if (state) {
      let authoritativeAt = state.serverTime ?? 0;
      for (const event of state.combatEvents) {
        authoritativeAt = Math.max(authoritativeAt, event.occurredAt);
      }
      if (authoritativeAt > now) {
        this.lastServerNow = authoritativeAt;
        now = authoritativeAt;
      }
      this.creatures.fastForward(now);
    }
    this.state = state;
    this.active = state !== null;
    if (state) {
      this.configureGrid(state);
      this.applyEffects(state, now);
    } else {
      this.effects.clear();
    }
    if (!state || !wasActive) {
      this.pending = false;
    }
    this.redraw();
  }

  public authenticate(): void {
    this.connectionMessage = '';
    this.connected = true;
    this.pending = false;
    this.apply(null);
  }

  public synchronizeClock(sentAt: number, receivedAt: number, serverTime: number): void {
    const roundTrip = Math.max(0, receivedAt - sentAt);
    if (roundTrip >= this.bestClockRtt) {
      return;
    }
    this.bestClockRtt = roundTrip;
    const midpoint = sentAt + roundTrip / 2;
    const sample = serverTime - midpoint;
    this.clockOffset = sample;
    this.clockReady = true;
    this.clockSynchronized = true;
  }

  public fail(): void {
    this.pending = false;
    this.status.setText('Não foi possível concluir. Tente novamente.').setVisible(true);
  }

  public disconnect(): void {
    this.showConnectionStatus('Conexão perdida. Reconectando…');
  }

  public showConnectionStatus(message: string): void {
    this.connected = false;
    this.pending = false;
    this.connectionMessage = message;
    this.status.setText(message).setVisible(true);
  }

  public update(_now: number): void {
    if (!this.active) {
      return;
    }
    const serverNow = this.serverNow(Date.now());
    this.creatures.update(serverNow);
    this.effects.update(serverNow);
  }

  private redraw(): void {
    const { width, height } = this.scene.scale;
    const parent = this.scene.scale.parentSize;
    const scale = Math.max(parent.width / width, parent.height / height) || 1;
    const visibleWidth = parent.width / scale;
    const visibleHeight = parent.height / scale;
    this.status.setPosition((width - visibleWidth) / 2 + 8, (height - visibleHeight) / 2 + 8);
    this.status.setWordWrapWidth(Math.max(48, visibleWidth - 32));
    if (this.connectionMessage) {
      this.status.setText(this.connectionMessage).setVisible(true);
      return;
    }
    this.creatures.clear();
    const state = this.state;
    if (!state) {
      this.status.setText('').setVisible(false);
      this.creatures.reset();
      this.backdrop.removeAll(true);
      this.backdropKey = '';
      if (this.player) {
        this.player.destroy();
      }
      this.player = null;
      this.focusCamera(null);
      return;
    }
    this.configureGrid(state);
    this.creatures.configure(state.grid.width, state.grid.height, this.tileSize, width, height);
    const backdropKey = `${width}:${height}:${JSON.stringify(state.grid)}`;
    if (this.backdropKey !== backdropKey) {
      this.backdrop.removeAll(true);
      this.drawBackdrop(width, height, state.grid);
      this.backdropKey = backdropKey;
    }
    this.addPlayer(state.playerPosition);
    const now = this.serverNow(Date.now());
    this.addCreatures(state, now);
    this.creatures.finish(now);
    this.creatures.update(now);
    this.focusCamera(this.activeCreaturePosition(state));
    const waiting = state.enemies.length === 0 ? 'Aguardando próxima onda…' : '';
    const message = this.pending ? 'Voltando à cidade…' : waiting;
    this.status.setText(message).setVisible(message.length > 0);
  }

  private addCreatures(state: HuntState, now: number): void {
    const allySpec: CreatureSpec = {
      direction: ALLY_DIRECTION,
      faceTargetUntil: Number.POSITIVE_INFINITY,
      health: state.activeCreatureHealth,
      key: `${CREATURE_ALLY_KEY}-${state.activeCreatureId}`,
      maximumHealth: state.activeCreatureMaximumHealth,
      movement: null,
      speciesId: state.activeCreatureSpeciesId,
      target: HuntView.closestEnemyPosition(state),
      tile: state.allyPosition,
    };
    this.creatures.add(allySpec, now);
    for (const [index, enemy] of state.enemies.entries()) {
      const enemySpec: CreatureSpec = {
        direction: ENEMY_DIRECTION,
        faceTargetUntil: HuntView.enemyFaceTargetUntil(enemy.position, state, now),
        health: enemy.health,
        key: enemy.combatId
          ? `${ENEMY_KEY_PREFIX}${enemy.combatId}`
          : `${ENEMY_KEY_PREFIX}${state.wave}-${index}-${enemy.id}`,
        maximumHealth: enemy.maximumHealth,
        movement: enemy.movement,
        speciesId: enemy.id,
        target: state.allyPosition,
        tile: enemy.position,
      };
      this.creatures.add(enemySpec, now);
    }
  }

  private configureGrid(state: HuntState): void {
    const { width, height } = this.scene.scale;
    this.tileSize = state.grid.tileSize;
    this.gridOriginX = (width - state.grid.width * this.tileSize) / 2;
    this.gridOriginY = (height - state.grid.height * this.tileSize) / 2;
    this.effects.configure(this.gridOriginX, this.gridOriginY, this.tileSize);
  }

  private activeCreaturePosition(state: HuntState): Tile {
    return {
      x: this.gridOriginX + (state.allyPosition.x + 0.5) * this.tileSize,
      y: this.gridOriginY + (state.allyPosition.y + 0.5) * this.tileSize,
    };
  }

  private static closestEnemyPosition(state: HuntState): Tile | null {
    let target: Tile | null = null;
    let shortestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of state.enemies) {
      if (enemy.health === 0) {
        continue;
      }
      const distance = Math.max(
        Math.abs(enemy.position.x - state.allyPosition.x),
        Math.abs(enemy.position.y - state.allyPosition.y),
      );
      if (distance < shortestDistance) {
        target = enemy.position;
        shortestDistance = distance;
      }
    }
    return target;
  }

  private static enemyFaceTargetUntil(position: Tile, state: HuntState, now: number): number {
    if (HuntView.isAdjacent(position, state.allyPosition)) {
      return Number.POSITIVE_INFINITY;
    }
    for (const event of state.combatEvents) {
      if (event.from.x === position.x && event.from.y === position.y && event.kind !== 'melee') {
        return Math.max(now, event.occurredAt) + 180;
      }
    }
    return 0;
  }

  private static isAdjacent(first: Tile, second: Tile): boolean {
    return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y)) <= 1;
  }

  private drawBackdrop(width: number, height: number, grid: HuntGrid): void {
    this.backdrop.add(
      this.scene.add.rectangle(width / 2, height / 2, width, height, BACKDROP_COLOR),
    );
    const blocked = new Set(grid.blocked.map(tileKey));
    const tiles = this.scene.add.graphics();
    const extraColumns = Math.ceil(Math.max(0, this.gridOriginX) / this.tileSize);
    const extraRows = Math.ceil(Math.max(0, this.gridOriginY) / this.tileSize);
    for (let row = -extraRows; row < grid.height + extraRows; row += 1) {
      for (let column = -extraColumns; column < grid.width + extraColumns; column += 1) {
        const checked = (row + column) % 2 === 0;
        const position = { x: column, y: row };
        const color = blocked.has(tileKey(position))
          ? BLOCKED_TILE_COLOR
          : checked
            ? 0x77777f
            : 0x909099;
        tiles.fillStyle(color);
        tiles.fillRect(
          this.gridOriginX + column * this.tileSize,
          this.gridOriginY + row * this.tileSize,
          this.tileSize,
          this.tileSize,
        );
      }
    }
    tiles.lineStyle(1, GRID_BORDER_COLOR, 1);
    // tiles.strokeRect(
    //   this.gridOriginX - 1,
    //   this.gridOriginY - 1,
    //   grid.width * this.tileSize + 2,
    //   grid.height * this.tileSize + 2,
    // );
    this.backdrop.add(tiles);
  }

  private addPlayer(position: Tile): void {
    if (this.player) {
      this.player.setPosition(
        this.gridOriginX + position.x * this.tileSize + this.tileSize / 2,
        this.gridOriginY + position.y * this.tileSize + this.tileSize / 2,
      );
      return;
    }
    const sprite = this.scene.add.sprite(
      this.gridOriginX + position.x * this.tileSize + this.tileSize / 2,
      this.gridOriginY + position.y * this.tileSize + this.tileSize / 2,
      PLAYER_ATLAS_KEY,
      PLAYER_FRAME,
    );
    sprite.setOrigin(0.5, 0.75);
    this.player = sprite;
    this.overlay.add(sprite);
  }

  private observeServerTime(serverTime: number, receivedAt: number): void {
    if (this.clockSynchronized) {
      return;
    }
    const sample = serverTime - receivedAt;
    if (!this.clockReady) {
      this.clockOffset = sample;
      this.clockReady = true;
      return;
    }
    // The largest sample represents the lowest observed transport latency.
    if (sample > this.clockOffset) {
      this.clockOffset += (sample - this.clockOffset) * 0.1;
    }
  }

  private applyEffects(state: HuntState, now: number): void {
    if (this.combatEventCutoff <= 0) {
      this.effects.apply(state, now);
      return;
    }
    const cutoff = this.combatEventCutoff;
    function isNewEvent(event: HuntState['combatEvents'][number]): boolean {
      return event.occurredAt > cutoff;
    }
    const combatEvents = state.combatEvents.filter(isNewEvent);
    const filteredState = { ...state, combatEvents };
    this.effects.apply(filteredState, now);
  }

  private static recoveryCutoff(state: HuntState): number {
    let cutoff = state.serverTime ?? 0;
    for (const event of state.combatEvents) {
      cutoff = Math.max(cutoff, event.occurredAt);
    }
    return cutoff;
  }

  private retireHunt(huntId: string): void {
    this.retiredHunts.add(huntId);
    while (this.retiredHunts.size > MAXIMUM_RETIRED_HUNTS) {
      const oldest = this.retiredHunts.values().next().value;
      if (oldest === undefined) {
        break;
      }
      this.retiredHunts.delete(oldest);
    }
  }

  private serverNow(clientNow: number): number {
    const estimated = this.clockReady ? clientNow + this.clockOffset : clientNow;
    this.lastServerNow = Math.max(this.lastServerNow, estimated);
    return this.lastServerNow;
  }

  private destroy(): void {
    this.scene.scale.off('resize', this.redraw, this);
  }
}
