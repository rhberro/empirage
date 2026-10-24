import { huntMapBySlug } from '@creatures/contracts/huntMap';
import type { HuntMap } from '@creatures/contracts/huntMap';
import type { Application } from 'pixi.js';
import { Container } from 'pixi.js';

import { huntStore } from '~/entities/hunt/model/huntStore';
import { worldStore } from '~/entities/world';
import { computeCamera, smoothCamera } from '~/entities/world/model/camera';
import {
  computeCanvasLayout,
  VIEWPORT_H,
  VIEWPORT_W,
  type CanvasLayout,
} from '~/entities/world/model/scale';
import { computeActorPosition } from '~/entities/world/model/steps';
import { TILE_SIZE_PX, type Pixel } from '~/entities/world/model/tiles';
import { createPixiApp, destroyPixiApp } from '~/entities/world/ui/pixiApp';

import { createCreatureLayer, type CreatureLayer } from './layers/creatureLayer';
import { createEffectLayer, type EffectLayer } from './layers/effectLayer';
import { createHuntGroundLayer, type HuntGroundLayer } from './layers/groundLayer';
import { createHealthLayer, type HealthLayer } from './layers/healthLayer';

/**
 * The imperative Pixi scene of the hunt.
 *
 * It mirrors the city scene: the store is read inside the ticker, the camera
 * follows the active creature and the canvas keeps a fixed logical size that
 * CSS zooms. The ground is built when the first snapshot names the area, so a
 * blank scene never paints until the hunt is known.
 */
export class HuntScene {
  private app: Application | null;
  private camera: { x: number; y: number };
  private creatures: CreatureLayer | null;
  private disposed: boolean;
  private effects: EffectLayer | null;
  private ground: HuntGroundLayer | null;
  private readonly host: HTMLDivElement;
  private health: HealthLayer | null;
  private map: HuntMap | null;
  private readonly observer: ResizeObserver;
  private readonly tickCallback: () => void;
  private world: Container | null;

  public constructor(host: HTMLDivElement) {
    this.app = null;
    this.camera = { x: 0, y: 0 };
    this.creatures = null;
    this.disposed = false;
    this.effects = null;
    this.ground = null;
    this.host = host;
    this.health = null;
    this.map = null;
    this.observer = new ResizeObserver(this.resize.bind(this));
    this.tickCallback = this.tick.bind(this);
    this.world = null;
  }

  public start(): void {
    this.observer.observe(this.host);
    createPixiApp().then(this.mountApp.bind(this), this.abandon.bind(this));
  }

  public destroy(): void {
    this.disposed = true;
    this.observer.disconnect();
    this.destroyLayers();
    if (this.app !== null) {
      this.app.ticker.remove(this.tickCallback);
      destroyPixiApp(this.app);
      this.app = null;
    }
  }

  private abandon(): void {
    this.destroy();
  }

  private mountApp(app: Application): void {
    if (this.disposed) {
      destroyPixiApp(app);
      return;
    }
    this.app = app;
    this.host.append(app.canvas);
    app.renderer.resize(VIEWPORT_W, VIEWPORT_H);
    app.canvas.style.imageRendering = 'pixelated';
    this.world = new Container();
    app.stage.addChild(this.world);
    // The map is painted into a render texture, and a render-to-texture while
    // the app is drawing leaves the root target on the texture. The ticker
    // starts only after the ground exists, so the first stage render already
    // targets the canvas.
    app.stop();
    this.resize();
    Promise.all([createCreatureLayer(), createHealthLayer(), createEffectLayer()]).then(
      this.mountLayers.bind(this),
      this.abandon.bind(this),
    );
    this.loadInitialMap();
  }

  private loadInitialMap(): void {
    if (this.disposed || this.app === null) {
      return;
    }
    const snapshot = huntStore.getState().snapshot;
    if (snapshot === null) {
      setTimeout(this.loadInitialMap.bind(this), 50);
      return;
    }
    this.loadMap(snapshot.session.areaSlug);
  }

  private mountLayers(layers: [CreatureLayer, HealthLayer, EffectLayer]): void {
    const [creatures, health, effects] = layers;
    if (this.disposed) {
      return;
    }
    this.creatures = creatures;
    this.health = health;
    this.effects = effects;
    this.addLayers();
  }

  private resize(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    this.applyCanvasStyle(computeCanvasLayout(width, height));
  }

  private applyCanvasStyle(layout: CanvasLayout): void {
    if (this.app === null) {
      return;
    }
    const canvas = this.app.canvas;
    canvas.style.position = 'absolute';
    canvas.style.left = layout.offsetX + 'px';
    canvas.style.top = layout.offsetY + 'px';
    canvas.style.width = layout.canvasWidth + 'px';
    canvas.style.height = layout.canvasHeight + 'px';
  }

  private tick(): void {
    if (this.app === null || this.world === null) {
      return;
    }
    const state = huntStore.getState();
    const snapshot = state.snapshot;
    if (snapshot === null) {
      return;
    }
    if (this.ground === null) {
      return;
    }
    const now = worldStore.getState().renderNow();
    const playerPixel = computeActorPosition(
      snapshot.player.segment === undefined ? [] : [snapshot.player.segment],
      now,
      snapshot.player.tile,
    );
    this.updateCamera(playerPixel);
    const wilds = snapshot.wilds ?? [];
    this.creatures?.update(
      { events: state.events, player: snapshot.player, trainer: snapshot.trainer, wilds },
      now,
    );
    this.health?.update({ player: snapshot.player, wilds }, now);
    this.effects?.update(
      {
        creatures: [snapshot.player, ...wilds],
        events: state.events,
        trainer: snapshot.trainer,
        waves: snapshot.waves,
      },
      now,
    );
  }

  private loadMap(slug: string): void {
    const map = huntMapBySlug(slug);
    if (map === null) {
      this.startTicker();
      return;
    }
    this.map = map;
    const app = this.app;
    if (app === null) {
      return;
    }
    createHuntGroundLayer(app.renderer, map).then(
      this.mountGround.bind(this),
      this.abandon.bind(this),
    );
  }

  private mountGround(ground: HuntGroundLayer): void {
    if (this.disposed || this.world === null) {
      ground.destroy();
      return;
    }
    this.ground = ground;
    this.world.addChild(ground.container);
    this.addLayers();
    this.startTicker();
  }

  /**
   * Starts the frame loop after the ground exists.
   *
   * The first render targets the canvas and paints the ground; from then on the
   * ticker renders the layers as they are added and updated.
   */
  private startTicker(): void {
    if (this.app === null) {
      return;
    }
    this.app.renderer.render({ container: this.app.stage });
    this.app.ticker.add(this.tickCallback);
    this.app.start();
  }

  /**
   * Adds the dynamic layers once both the ground and the assets are ready.
   *
   * The ground and the layers load in parallel, so either can arrive first.
   * Adding the layers only when both exist keeps the scene from being blank
   * when the ground wins the race.
   */
  private addLayers(): void {
    if (
      this.world === null ||
      this.ground === null ||
      this.creatures === null ||
      this.health === null ||
      this.effects === null
    ) {
      return;
    }
    this.world.addChild(this.effects.waves);
    this.world.addChild(this.creatures.container);
    this.world.addChild(this.health.container);
    this.world.addChild(this.effects.fx);
  }

  private updateCamera(pixel: Pixel): void {
    if (this.map === null || this.world === null) {
      return;
    }
    const center = {
      x: pixel.x + TILE_SIZE_PX / 2,
      y: pixel.y + TILE_SIZE_PX / 2,
    };
    const worldPx = { x: this.map.width * TILE_SIZE_PX, y: this.map.height * TILE_SIZE_PX };
    this.camera = smoothCamera(
      this.camera,
      computeCamera(center, { x: VIEWPORT_W, y: VIEWPORT_H }, worldPx),
    );
    this.world.position.set(-this.camera.x, -this.camera.y);
  }

  private destroyLayers(): void {
    if (this.ground !== null) {
      this.ground.destroy();
      this.ground = null;
    }
    this.creatures = null;
    this.health = null;
    this.effects = null;
  }
}
