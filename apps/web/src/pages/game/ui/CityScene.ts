import { Scene } from 'phaser';

import type { GameEvent, Tile } from '../api/game-protocol';
import { GameSession } from '../api/game-socket';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import { configureCameraViewport } from '../lib/camera-viewport';
import { PlayerInput } from '../lib/player-input';
import { PlayerWorld } from '../model/player-world';
import type { WorldPlayer } from '../model/player-world';
import { bindCityInput } from './city-input';
import { HuntView } from './HuntView';
import {
  CELL_SIZE,
  CHARACTER_ATLAS_KEY,
  currentPhase,
  frameName,
  renderPlayer,
  showAtlasError,
  tileCenter,
} from './player-visual';
import type { VisualPlayer } from './player-visual';

const MAP_COLUMNS = 100;
const MAP_ROWS = 100;
const SNAP_DISTANCE = 3;
type EventHandler = () => void;
type HuntStateChangeHandler = (hunt: HuntState | null) => void;
type HuntCommandSenderChangeHandler = (
  sender: ((command: HuntCommand) => boolean) | undefined,
) => void;

export class CityScene extends Scene {
  private readonly characterId: string;
  private readonly deactivationHandler: EventHandler;
  private readonly onHuntStateChange: HuntStateChangeHandler;
  private readonly onHuntCommandSenderChange: HuntCommandSenderChangeHandler;
  private readonly playerInput: PlayerInput;
  private readonly session: GameSession;
  private readonly visibilityHandler: EventHandler;
  private readonly visuals = new Map<string, VisualPlayer>();
  private readonly world = new PlayerWorld();
  private huntView: HuntView | null = null;

  public constructor(
    characterId: string,
    onHuntStateChange: HuntStateChangeHandler,
    onHuntCommandSenderChange: HuntCommandSenderChangeHandler,
  ) {
    super('CityScene');
    this.characterId = characterId;
    this.deactivationHandler = this.handleDeactivation.bind(this);
    this.onHuntStateChange = onHuntStateChange;
    this.onHuntCommandSenderChange = onHuntCommandSenderChange;
    this.visibilityHandler = this.handleVisibilityChange.bind(this);
    const options = {
      characterId,
      onDisconnect: this.handleDisconnect.bind(this),
      onEvent: this.handleGameEvent.bind(this),
    };
    this.session = new GameSession(options);
    this.playerInput = new PlayerInput(this.session.send.bind(this.session));
  }

  public preload(): void {
    this.load.atlas(
      CHARACTER_ATLAS_KEY,
      '/assets/characters/male/male-walking-running.png',
      '/assets/characters/male/male-walking-running.json',
    );
  }

  public create(): void {
    this.drawCity();
    this.huntView = new HuntView(
      this,
      this.session.send.bind(this.session),
      this.focusHuntCamera.bind(this),
    );
    showAtlasError(this);
    this.playerInput.enabled = false;
    this.configureCameraViewport();
    this.scale.on('resize', this.configureCameraViewport, this);
    this.bindInput();
    globalThis.addEventListener('blur', this.deactivationHandler);
    globalThis.addEventListener('pagehide', this.deactivationHandler);
    globalThis.document.addEventListener('visibilitychange', this.visibilityHandler);
    this.events.once('shutdown', this.shutdown, this);
    this.onHuntCommandSenderChange(this.session.send.bind(this.session));
    this.session.start();
  }

  public update(): void {
    const now = Date.now();
    for (const visual of this.visuals.values()) {
      renderPlayer(visual, now);
    }
    if (this.huntView) {
      this.huntView.update(now);
    }
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }
    const requestHunt = this.toggleHunt.bind(this);
    bindCityInput(keyboard, this.playerInput, requestHunt);
  }

  private drawCity(): void {
    const graphics = this.add.graphics().setDepth(-1);
    for (let row = 0; row < MAP_ROWS; row += 1) {
      for (let column = 0; column < MAP_COLUMNS; column += 1) {
        graphics.fillStyle((row + column) % 2 === 0 ? 0x77777f : 0x909099);
        graphics.fillRect(column * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  // Scene event dispatch coordinates the mutually exclusive protocol event types.
  // eslint-disable-next-line complexity, max-lines-per-function
  private handleGameEvent(event: GameEvent): void {
    const huntView = this.huntView;
    if (event.type === 'connection_status') {
      this.playerInput.neutralize();
      this.playerInput.enabled = false;
      if (huntView) {
        huntView.showConnectionStatus(event.message);
      }
      return;
    }
    if (event.type === 'input_rejected') {
      this.handleInputRejected(event.reason);
      return;
    }
    if (event.type === 'hunt_state') {
      this.playerInput.neutralize();
      this.onHuntStateChange(event.hunt);
      if (huntView) {
        huntView.apply(event.hunt, event.huntId);
      }
      this.playerInput.enabled = !event.hunt && Boolean(huntView && huntView.connected);
      return;
    }
    if (event.type === 'hunt_clock') {
      if (huntView) {
        huntView.synchronizeClock(event.sentAt, event.receivedAt, event.serverTime);
      }
      return;
    }
    if (event.type === 'error') {
      if (huntView) {
        huntView.fail();
      }
      this.playerInput.enabled = Boolean(huntView && !huntView.active && huntView.connected);
      return;
    }
    if (event.type === 'authenticated') {
      if (huntView) {
        huntView.authenticate();
      }
      this.playerInput.enabled = true;
      this.world.applyAuthenticated(event);
    } else if (event.type === 'snapshot') {
      this.world.applySnapshot(event);
    } else if (event.type === 'movement_started') {
      this.world.applyMovement(event);
    } else if (event.type === 'player_idle' || event.type === 'player_joined') {
      this.world.applyPresence(event);
    } else if (event.type === 'player_left') {
      this.world.remove(event.characterId, event.tick);
    } else {
      return;
    }
    this.synchronizeVisuals(event.type === 'authenticated');
  }

  private handleInputRejected(reason: string): void {
    this.playerInput.neutralize();
    this.playerInput.enabled = false;
    if (this.huntView) {
      this.huntView.showConnectionStatus(reason);
    }
  }

  private synchronizeVisuals(forceSnap: boolean): void {
    const present = new Set<string>();
    for (const player of this.world.values()) {
      present.add(player.characterId);
      this.synchronizePlayer(player, forceSnap);
    }
    for (const [id, visual] of this.visuals) {
      if (!present.has(id)) {
        visual.sprite.destroy();
        this.visuals.delete(id);
      }
    }
  }

  private synchronizePlayer(player: WorldPlayer, forceSnap: boolean): void {
    let visual = this.visuals.get(player.characterId);
    let shouldForceSnap = forceSnap;
    if (!visual) {
      visual = this.createVisual(player.characterId, player.tile);
      shouldForceSnap = true;
    }
    const authoritative = player.movement ? player.movement.from : player.tile;
    const distance = Math.hypot(visual.tile.x - authoritative.x, visual.tile.y - authoritative.y);
    if (shouldForceSnap || distance >= SNAP_DISTANCE || !player.movement) {
      visual.sprite.setPosition(tileCenter(authoritative.x), tileCenter(authoritative.y));
      visual.sprite.setDepth(visual.sprite.y);
    }
    visual.tile = player.tile;
    if (player.movement !== visual.movement) {
      visual.phase = currentPhase(visual, Date.now());
      visual.movement = player.movement;
    }
    if (!player.movement) {
      visual.sprite.setTexture(CHARACTER_ATLAS_KEY, frameName('idle', player.direction, 1));
    }
  }

  private createVisual(characterId: string, tile: Tile): VisualPlayer {
    const sprite = this.add.sprite(
      tileCenter(tile.x),
      tileCenter(tile.y),
      CHARACTER_ATLAS_KEY,
      frameName('idle', 'south', 1),
    );
    sprite.setOrigin(0.5, 0.75).setDepth(sprite.y);
    const visual = { movement: null, phase: 0, sprite, tile };
    this.visuals.set(characterId, visual);
    if (characterId === this.characterId) {
      this.cameras.main.startFollow(sprite, true, 0.15, 0.15);
    }
    return visual;
  }

  private configureCameraViewport(): void {
    const camera = this.cameras.main;
    configureCameraViewport(camera, this.scale);
    camera.setBounds(0, 0, MAP_COLUMNS * CELL_SIZE, MAP_ROWS * CELL_SIZE);
  }

  private focusHuntCamera(target: Tile | null): void {
    const camera = this.cameras.main;
    if (target) {
      camera.stopFollow().centerOn(target.x, target.y);
      return;
    }
    const player = this.visuals.get(this.characterId);
    if (player) {
      camera.startFollow(player.sprite, true, 0.15, 0.15);
    }
  }

  private handleDeactivation(): void {
    this.playerInput.neutralize();
  }
  private handleDisconnect(): void {
    this.playerInput.neutralize();
    this.playerInput.enabled = false;
    if (this.huntView) {
      this.huntView.disconnect();
    }
  }
  private toggleHunt(event: KeyboardEvent): void {
    if (!this.huntView || event.repeat || this.huntView.pending || !this.huntView.connected) {
      return;
    }
    this.playerInput.neutralize();
    this.huntView.request(event);
    this.playerInput.enabled =
      !this.huntView.active && !this.huntView.pending && this.huntView.connected;
  }
  private handleVisibilityChange(): void {
    if (globalThis.document.hidden) {
      this.playerInput.neutralize();
    }
  }

  private shutdown(): void {
    this.playerInput.destroy();
    this.session.stop();
    this.onHuntCommandSenderChange();
    globalThis.removeEventListener('blur', this.deactivationHandler);
    globalThis.removeEventListener('pagehide', this.deactivationHandler);
    globalThis.document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.scale.off('resize', this.configureCameraViewport, this);
  }
}
