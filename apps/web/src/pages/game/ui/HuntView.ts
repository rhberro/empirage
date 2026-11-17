/* eslint-disable eslint/no-void, oxsome/no-inline-structural-types */
import type { GameObjects, Scene } from 'phaser';
/* eslint-disable max-lines */

import type { Tile } from '../api/game-protocol';
import { applyHuntDelta } from '../api/hunt-protocol';
import type {
  HuntCombatEvent,
  HuntCommand,
  HuntDeltaPatch,
  HuntGrid,
  HuntState,
} from '../api/hunt-protocol';
import type { HuntingLocation } from '../api/hunting-locations';
import { CREATURE_ALLY_KEY, HuntCreatures } from './hunt-creatures';
import type { CreatureSpec } from './hunt-creatures';
import { HuntEffects } from './hunt-effects';

type CommandSender = (command: HuntCommand) => boolean;
type CameraFocusHandler = (target: Tile | null) => void;
type TransitionChangeHandler = (active: boolean, message: string) => void;
type AssetsReadyHandler = () => void;
type HuntRenderField = keyof HuntDeltaPatch;

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
const HUNT_RENDER_FIELDS = [
  'activeCreatureAvailableAt',
  'activeCreatureHealth',
  'activeCreatureId',
  'activeCreatureMaximumHealth',
  'activeCreatureSpeciesId',
  'activeCreatureSwitchCompletesAt',
  'enemies',
  'enemyPatches',
  'enemySpawns',
  'playerPosition',
  'removedEnemyCombatIds',
  'wave',
] satisfies Array<HuntRenderField>;

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
  private readonly onTransitionChange: TransitionChangeHandler;
  private readonly onAssetsReady: AssetsReadyHandler;
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
  private readonly huntingLocations = new Map<number, HuntingLocation>();
  private partySpeciesIds: Array<number> = [];
  private partySpeciesIdsReady = false;
  private loadingHuntId: string | null = null;
  private combatEventCutoff = 0;
  public constructor(
    scene: Scene,
    send: CommandSender,
    focusCamera: CameraFocusHandler,
    onTransitionChange: TransitionChangeHandler,
    onAssetsReady: AssetsReadyHandler,
  ) {
    this.scene = scene;
    this.send = send;
    this.focusCamera = focusCamera;
    this.onTransitionChange = onTransitionChange;
    this.onAssetsReady = onAssetsReady;
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

  public start(
    command: Extract<HuntCommand, { type: 'start_hunt' }>,
    location: HuntingLocation,
    partySpeciesIds: Array<number>,
  ): boolean {
    if (this.pending || !this.connected) {
      return false;
    }
    this.pending = true;
    this.onTransitionChange(true, 'Carregando local de caça…');
    void this.loadHuntAssets(location, partySpeciesIds).then(
      this.sendAfterLoading.bind(this, command),
      this.handleLoadingFailure.bind(this),
    );
    return true;
  }

  public applyCombatEvent(event: HuntCombatEvent): void {
    this.effects.applyCombatEvent(event, Date.now());
  }

  public applyDelta(huntId: string, revision: number, patch: HuntDeltaPatch): boolean {
    const current = this.state;
    if (!current || current.huntId !== huntId || revision !== current.revision + 1) {
      return false;
    }
    const state = applyHuntDelta(current, patch, revision);
    this.state = state;
    const receivedAt = Date.now();
    if (patch.serverTime !== undefined) {
      this.observeServerTime(patch.serverTime, receivedAt);
    }
    const now = this.serverNow(receivedAt);
    this.creatures.fastForward(now);
    if (patch.captureAttempts !== undefined) {
      this.effects.applyCaptureAttempts(patch.captureAttempts, now);
    }
    if (!this.huntAssetsReady(state)) {
      this.loadCurrentHuntAssets();
      return true;
    }
    if (HuntView.canApplyEnemyPatch(patch)) {
      this.applyEnemyPatch(state, patch, now);
    } else if (HuntView.hasRenderPatch(patch)) {
      this.redraw();
    }
    return true;
  }

  public setHuntingLocations(locations: Array<HuntingLocation>): void {
    this.huntingLocations.clear();
    for (const location of locations) {
      this.huntingLocations.set(location.id, location);
    }
    this.loadCurrentHuntAssets();
  }

  public setPartySpeciesIds(speciesIds: Array<number>): void {
    this.partySpeciesIds = speciesIds;
    this.partySpeciesIdsReady = true;
    this.loadCurrentHuntAssets();
  }

  public leave(command: Extract<HuntCommand, { type: 'leave_hunt' }>): boolean {
    if (this.pending || !this.connected) {
      return false;
    }
    if (!this.send(command)) {
      this.disconnect();
      return false;
    }
    this.pending = true;
    this.onTransitionChange(true, 'Voltando para a cidade…');
    return true;
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
      if (!this.huntAssetsReady(state)) {
        this.loadCurrentHuntAssets();
        return;
      }
      this.configureGrid(state);
      this.applyEffects(state, now);
    } else {
      this.effects.clear();
    }
    if (!state || !wasActive) {
      this.pending = false;
      this.onTransitionChange(false, '');
    }
    this.redraw();
    this.onAssetsReady();
  }

  public authenticate(): void {
    this.connectionMessage = '';
    this.connected = true;
    this.pending = false;
  }

  public initialAssetsReady(): boolean {
    return this.state === null || this.huntAssetsReady(this.state);
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
    this.onTransitionChange(false, '');
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

  private sendAfterLoading(command: Extract<HuntCommand, { type: 'start_hunt' }>): void {
    if (!this.connected || !this.send(command)) {
      this.handleLoadingFailure();
    }
  }

  private handleLoadingFailure(): void {
    this.pending = false;
    this.onTransitionChange(false, '');
    this.fail();
  }

  private loadHuntAssets(location: HuntingLocation, partySpeciesIds: Array<number>): Promise<void> {
    const speciesIds = new Set<number>(partySpeciesIds);
    for (const species of location.species) {
      speciesIds.add(species.id);
    }
    const locationKey = `hunting-location-${location.id}`;
    if (!this.scene.textures.exists(locationKey)) {
      this.scene.load.spritesheet(locationKey, location.tilesetUrl, {
        frameHeight: location.map.tileSize,
        frameWidth: location.map.tileSize,
      });
    }
    for (const speciesId of speciesIds) {
      const creatureKey = `creature-${speciesId}`;
      if (!this.scene.textures.exists(creatureKey)) {
        const imageUrl = `/assets/creatures/atlases/${speciesId}.png`;
        const dataUrl = `/assets/creatures/atlases/${speciesId}.json`;
        this.scene.load.atlas(creatureKey, imageUrl, dataUrl);
      }
    }
    if (this.scene.load.totalToLoad === 0) {
      return Promise.resolve();
    }
    const scene = this.scene;
    function loadAssets(resolve: () => void, reject: () => void): void {
      function complete(): void {
        scene.load.off('loaderror', fail);
        resolve();
      }
      function fail(): void {
        scene.load.off('complete', complete);
        reject();
      }
      scene.load.once('complete', complete);
      scene.load.once('loaderror', fail);
      scene.load.start();
    }
    return new Promise(loadAssets);
  }

  private huntAssetsReady(state: HuntState): boolean {
    const location = this.huntingLocations.get(state.huntingLocationId);
    if (!location || !this.partySpeciesIdsReady) {
      return false;
    }
    const tilesetKey = `hunting-location-${location.id}`;
    if (!this.scene.textures.exists(tilesetKey)) {
      return false;
    }
    for (const speciesId of this.requiredSpeciesIds(state, location)) {
      if (!this.scene.textures.exists(`creature-${speciesId}`)) {
        return false;
      }
    }
    return true;
  }

  private requiredSpeciesIds(state: HuntState, location: HuntingLocation): Array<number> {
    const speciesIds = new Set<number>(this.partySpeciesIds);
    for (const species of location.species) {
      speciesIds.add(species.id);
    }
    if (state.activeCreatureSpeciesId !== null) {
      speciesIds.add(state.activeCreatureSpeciesId);
    }
    for (const enemy of state.enemies) {
      speciesIds.add(enemy.id);
    }
    return [...speciesIds];
  }

  private loadCurrentHuntAssets(): void {
    const state = this.state;
    if (!state || this.huntAssetsReady(state) || this.loadingHuntId === state.huntId) {
      if (state && this.huntAssetsReady(state)) {
        this.redraw();
      }
      return;
    }
    const location = this.huntingLocations.get(state.huntingLocationId);
    if (!location || !this.partySpeciesIdsReady) {
      this.pending = true;
      this.onTransitionChange(true, 'Preparando local de caça…');
      return;
    }
    const huntId = state.huntId;
    this.loadingHuntId = huntId;
    this.pending = true;
    this.onTransitionChange(true, 'Carregando local de caça…');
    void this.loadHuntAssets(location, this.requiredSpeciesIds(state, location)).then(
      this.completeCurrentHuntAssetLoad.bind(this, huntId),
      this.handleLoadingFailure.bind(this),
    );
  }

  private completeCurrentHuntAssetLoad(huntId: string): void {
    if (this.loadingHuntId === huntId) {
      this.loadingHuntId = null;
    }
    if (!this.state || this.state.huntId !== huntId) {
      return;
    }
    if (!this.huntAssetsReady(this.state)) {
      this.loadCurrentHuntAssets();
      return;
    }
    this.pending = false;
    this.onTransitionChange(false, '');
    this.redraw();
    this.onAssetsReady();
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
      this.drawBackdrop(width, height, state);
      this.backdropKey = backdropKey;
    }
    this.addPlayer(state.playerPosition);
    const now = this.serverNow(Date.now());
    this.addCreatures(state, now);
    this.creatures.finish(now);
    this.creatures.update(now);
    this.focusCamera(this.activeCreaturePosition(state));
    const message = this.pending ? 'Voltando à cidade…' : '';
    this.status.setText(message).setVisible(message.length > 0);
  }

  private addCreatures(state: HuntState, now: number): void {
    this.addAlly(state, now);
    for (const [index, enemy] of state.enemies.entries()) {
      this.addEnemy(state, enemy, index, now);
    }
  }

  private addAlly(state: HuntState, now: number): void {
    const hasActiveCreatureTarget = now >= state.activeCreatureAvailableAt;
    const allySpec: CreatureSpec = {
      direction: ALLY_DIRECTION,
      faceTargetUntil: Number.POSITIVE_INFINITY,
      health: state.activeCreatureHealth,
      key: `${CREATURE_ALLY_KEY}-${state.activeCreatureId}`,
      maximumHealth: state.activeCreatureMaximumHealth,
      movement: null,
      speciesId: state.activeCreatureSpeciesId,
      switchesOutAt: state.activeCreatureSwitchCompletesAt,
      target: hasActiveCreatureTarget ? HuntView.closestEnemyPosition(state) : null,
      tile: state.allyPosition,
    };
    this.creatures.add(allySpec, now);
  }

  private addEnemy(
    state: HuntState,
    enemy: HuntState['enemies'][number],
    index: number,
    now: number,
  ): void {
    const hasActiveCreatureTarget = now >= state.activeCreatureAvailableAt;
    const enemySpec: CreatureSpec = {
      direction: ENEMY_DIRECTION,
      faceTargetUntil: HuntView.enemyFaceTargetUntil(enemy.position, state, now),
      health: enemy.health,
      key: HuntView.enemyKey(enemy, state, index),
      maximumHealth: enemy.maximumHealth,
      movement: enemy.movement,
      speciesId: enemy.id,
      switchesOutAt: undefined,
      target: hasActiveCreatureTarget ? state.allyPosition : null,
      tile: enemy.position,
    };
    this.creatures.add(enemySpec, now);
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

  private drawBackdrop(width: number, height: number, state: HuntState): void {
    const { grid } = state;
    this.backdrop.add(
      this.scene.add.rectangle(width / 2, height / 2, width, height, BACKDROP_COLOR),
    );
    const location = this.huntingLocations.get(state.huntingLocationId);
    const tilesetKey = `hunting-location-${state.huntingLocationId}`;
    if (location && this.scene.textures.exists(tilesetKey)) {
      this.drawTilesetBackdrop(location, tilesetKey, grid);
      return;
    }
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

  private drawTilesetBackdrop(location: HuntingLocation, tilesetKey: string, grid: HuntGrid): void {
    const frames = new Map<string, number>();
    for (const tile of location.map.tiles) {
      frames.set(tileKey(tile), tile.frame);
    }
    for (let row = 0; row < grid.height; row += 1) {
      for (let column = 0; column < grid.width; column += 1) {
        const position = { x: column, y: row };
        const frame = frames.get(tileKey(position)) ?? location.map.defaultTileFrame;
        const tile = this.scene.add.sprite(
          this.gridOriginX + column * this.tileSize + this.tileSize / 2,
          this.gridOriginY + row * this.tileSize + this.tileSize / 2,
          tilesetKey,
          frame,
        );
        this.backdrop.add(tile);
      }
    }
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

  private static hasRenderPatch(patch: HuntDeltaPatch): boolean {
    for (const field of HUNT_RENDER_FIELDS) {
      if (patch[field] !== undefined) {
        return true;
      }
    }
    return false;
  }

  private static canApplyEnemyPatch(patch: HuntDeltaPatch): boolean {
    const hasEnemyPatch =
      patch.enemyPatches !== undefined ||
      patch.enemySpawns !== undefined ||
      patch.removedEnemyCombatIds !== undefined;
    return hasEnemyPatch && !HuntView.hasNonEnemyRenderPatch(patch);
  }

  private static hasNonEnemyRenderPatch(patch: HuntDeltaPatch): boolean {
    return (
      patch.activeCreatureAvailableAt !== undefined ||
      patch.activeCreatureHealth !== undefined ||
      patch.activeCreatureId !== undefined ||
      patch.activeCreatureMaximumHealth !== undefined ||
      patch.activeCreatureSpeciesId !== undefined ||
      patch.activeCreatureSwitchCompletesAt !== undefined ||
      patch.enemies !== undefined ||
      patch.playerPosition !== undefined
    );
  }

  private static enemyKey(
    enemy: HuntState['enemies'][number],
    state: HuntState,
    index: number,
  ): string {
    return enemy.combatId
      ? `${ENEMY_KEY_PREFIX}${enemy.combatId}`
      : `${ENEMY_KEY_PREFIX}${state.wave}-${index}-${enemy.id}`;
  }

  private applyEnemyPatch(state: HuntState, patch: HuntDeltaPatch, now: number): void {
    for (const combatId of patch.removedEnemyCombatIds ?? []) {
      this.creatures.remove(`${ENEMY_KEY_PREFIX}${combatId}`, now);
    }
    for (const enemyPatch of patch.enemyPatches ?? []) {
      const index = HuntView.enemyIndex(state, enemyPatch.combatId);
      if (index >= 0) {
        const enemy = state.enemies[index];
        if (enemy) {
          this.addEnemy(state, enemy, index, now);
        }
      }
    }
    for (const enemy of patch.enemySpawns ?? []) {
      const index = HuntView.enemyIndex(state, enemy.combatId);
      if (index >= 0) {
        this.addEnemy(state, enemy, index, now);
      }
    }
    this.addAlly(state, now);
    this.creatures.update(now);
  }

  private static enemyIndex(state: HuntState, combatId: string | undefined): number {
    for (const [index, candidate] of state.enemies.entries()) {
      if (candidate.combatId === combatId) {
        return index;
      }
    }
    return -1;
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
