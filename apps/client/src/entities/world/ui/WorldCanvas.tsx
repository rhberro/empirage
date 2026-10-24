import { Box } from '@chakra-ui/react';
import { CITY_MAP } from '@creatures/contracts/city';
import type { Direction, Tile } from '@creatures/contracts/world';
import type { Application, FederatedPointerEvent } from 'pixi.js';
import { Container } from 'pixi.js';
import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import { worldStore } from '~/entities/world';
import { computeCamera, smoothCamera } from '~/entities/world/model/camera';
import { buildPrediction, readOrigin } from '~/entities/world/model/prediction';
import {
  computeCanvasLayout,
  VIEWPORT_H,
  VIEWPORT_W,
  type CanvasLayout,
} from '~/entities/world/model/scale';
import { computeActorPosition } from '~/entities/world/model/steps';
import { adjacentTile, screenToTile, TILE_SIZE_PX, type Pixel } from '~/entities/world/model/tiles';

import { createActorsLayer, type ActorsLayer } from './layers/actorsRenderer';
import { createGroundLayer, type GroundLayer } from './layers/groundRenderer';
import { createPixiApp, destroyPixiApp } from './pixiApp';

const WORLD_PX = { x: CITY_MAP.width * TILE_SIZE_PX, y: CITY_MAP.height * TILE_SIZE_PX };
const VIEWPORT = { x: VIEWPORT_W, y: VIEWPORT_H };

export type WorldCanvasProps = {
  requestMove(target: Tile): Promise<unknown>;
};

/**
 * The canvas of the city, drawn by Pixi and read from the world store.
 *
 * The component owns the canvas only: it mounts the application, follows the
 * actor with the camera and turns clicks and keys into moves. The store is
 * read inside the ticker, never through React, so a frame never re-renders.
 */
export function WorldCanvas(props: WorldCanvasProps): ReactElement {
  const requestMove = props.requestMove;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const requestMoveRef = useRef(requestMove);
  requestMoveRef.current = requestMove;

  useEffect(mount, []);

  function mount(): (() => void) | undefined {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }
    const scene = new WorldScene(host, requestMoveRef.current);
    scene.start();
    return function cleanup(): void {
      scene.destroy();
    };
  }

  return <Box bg="bg.sunken" flex="1" overflow="hidden" position="relative" ref={hostRef} />;
}

/**
 * The direction a key walks toward, when it is a movement key.
 */
function directionFromKey(key: string): Direction | undefined {
  if (key === 'w' || key === 'ArrowUp') {
    return 'up';
  }
  if (key === 's' || key === 'ArrowDown') {
    return 'down';
  }
  if (key === 'a' || key === 'ArrowLeft') {
    return 'left';
  }
  if (key === 'd' || key === 'ArrowRight') {
    return 'right';
  }
  return undefined;
}

/**
 * A move that failed is not the concern of the canvas: the prediction is
 * dropped, the position stays where the server confirmed it, and the
 * connection screen takes over on its own if the channel is gone.
 */
function clearPredictionOnFailure(): void {
  worldStore.getState().clearPrediction();
}

type RequestMove = (target: Tile) => Promise<unknown>;

/**
 * The imperative Pixi scene of the city.
 *
 * It holds the application, the layers and the camera, and owns every listener
 * it registers. The canvas keeps a fixed logical size and is zoomed by CSS,
 * never by scaling the stage.
 */
class WorldScene {
  private actors: ActorsLayer | null;
  private app: Application | null;
  private camera: Pixel;
  private disposed: boolean;
  private ground: GroundLayer | null;
  private readonly host: HTMLDivElement;
  private readonly keydownCallback: (event: KeyboardEvent) => void;
  private letterbox: Pixel;
  private readonly observer: ResizeObserver;
  private readonly pointerTapCallback: (event: FederatedPointerEvent) => void;
  private readonly requestMove: RequestMove;
  private readonly tickCallback: () => void;
  private world: Container | null;
  private zoom: number;

  public constructor(host: HTMLDivElement, requestMove: RequestMove) {
    this.actors = null;
    this.app = null;
    this.camera = { x: 0, y: 0 };
    this.disposed = false;
    this.ground = null;
    this.host = host;
    this.keydownCallback = this.handleKeyDown.bind(this);
    this.letterbox = { x: 0, y: 0 };
    this.observer = new ResizeObserver(this.resize.bind(this));
    this.pointerTapCallback = this.handlePointerTap.bind(this);
    this.requestMove = requestMove;
    this.tickCallback = this.tick.bind(this);
    this.world = null;
    this.zoom = 1;
  }

  public start(): void {
    this.observer.observe(this.host);
    window.addEventListener('keydown', this.keydownCallback);
    createPixiApp().then(this.mountApp.bind(this), this.abandon.bind(this));
  }

  public destroy(): void {
    this.disposed = true;
    this.observer.disconnect();
    window.removeEventListener('keydown', this.keydownCallback);
    if (this.ground !== null) {
      this.ground.destroy();
      this.ground = null;
    }
    if (this.app !== null) {
      this.app.ticker.remove(this.tickCallback);
      this.app.stage.off('pointertap', this.pointerTapCallback);
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
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointertap', this.pointerTapCallback);
    app.ticker.add(this.tickCallback);
    this.resize();
    Promise.all([createGroundLayer(app.renderer, CITY_MAP), createActorsLayer()]).then(
      this.mountLayers.bind(this),
      this.abandon.bind(this),
    );
  }

  private mountLayers(layers: [GroundLayer, ActorsLayer]): void {
    const [ground, actors] = layers;
    if (this.disposed) {
      ground.destroy();
      return;
    }
    this.ground = ground;
    this.actors = actors;
    if (this.world !== null) {
      this.world.addChild(ground.sprite);
      this.world.addChild(actors.container);
    }
  }

  private resize(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    const layout = computeCanvasLayout(width, height);
    this.zoom = layout.zoom;
    this.letterbox = { x: layout.offsetX, y: layout.offsetY };
    this.applyCanvasStyle(layout);
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
    if (this.app === null || this.world === null || this.actors === null) {
      return;
    }
    const state = worldStore.getState();
    const now = state.now();
    const renderNow = state.renderNow();
    const playerPath = state.prediction === null ? state.path : [...state.path, state.prediction];
    if (state.you !== null) {
      const position = computeActorPosition(playerPath, now, state.you.position);
      const follow = { x: position.x + TILE_SIZE_PX / 2, y: position.y + TILE_SIZE_PX / 2 };
      this.camera = smoothCamera(this.camera, computeCamera(follow, VIEWPORT, WORLD_PX));
    }
    this.world.position.set(-this.camera.x, -this.camera.y);
    this.actors.update({ actors: state.actors, path: playerPath, you: state.you }, now, renderNow);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // A held key auto-repeats; one press is one move, never a burst of moves.
    if (event.repeat) {
      return;
    }
    const direction = directionFromKey(event.key);
    if (direction === undefined) {
      return;
    }
    event.preventDefault();
    const state = worldStore.getState();
    const origin = readOrigin(state, state.now());
    if (origin === null) {
      return;
    }
    const target = adjacentTile(origin, direction);
    predictMove(target);
    void this.requestMove(target).catch(clearPredictionOnFailure);
  }

  private handlePointerTap(event: FederatedPointerEvent): void {
    const rect = this.host.getBoundingClientRect();
    const screen = { x: event.client.x - rect.left, y: event.client.y - rect.top };
    const target = screenToTile(screen, this.letterbox, this.zoom, this.camera);
    predictMove(target);
    void this.requestMove(target).catch(clearPredictionOnFailure);
  }
}

/**
 * Shows the first step before the server answers.
 *
 * Only one step is predicted at a time: the rest of the walk is the answer of
 * the server, and a second click before the answer would replace a step that
 * is already on screen.
 */
function predictMove(target: Tile): void {
  const state = worldStore.getState();
  if (state.prediction !== null) {
    return;
  }
  const segment = buildPrediction({ map: CITY_MAP, now: state.now(), state, target });
  if (segment !== null) {
    state.predictMove(segment);
  }
}
