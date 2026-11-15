/* eslint-disable oxc/no-optional-chaining, react-hooks/exhaustive-deps, oxsome/no-inline-functions-objects-arrays */
import { AUTO, Game, Scale } from 'phaser';
import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import { authStore } from '~/shared/auth';
import { getSelectedCharacter } from '~/shared/session';

import type { CharacterProfile, CollectionStateEvent } from '../api/game-protocol';
import type { HuntCommand, HuntState } from '../api/hunt-protocol';
import type { HuntingLocation } from '../api/hunting-locations';
import { CityScene } from './CityScene';

const GAME_WIDTH = 480;
const GAME_HEIGHT = 288;
type Cleanup = () => void;
type HuntStateChangeHandler = (hunt: HuntState | null) => void;
type CollectionChangeHandler = (collection: CollectionStateEvent['collection']) => void;
type CharacterProfileChangeHandler = (profile: CharacterProfile) => void;
type HuntCommandSenderChangeHandler = (
  sender: ((command: HuntCommand) => boolean) | undefined,
) => void;
type TransitionChangeHandler = (active: boolean, message: string) => void;
type GameCanvasProps = {
  huntingLocations: Array<HuntingLocation>;
  onCharacterProfileChange: CharacterProfileChangeHandler;
  onHuntCommandSenderChange: HuntCommandSenderChangeHandler;
  onCollectionChange: CollectionChangeHandler;
  onHuntStateChange: HuntStateChangeHandler;
  onTransitionChange: TransitionChangeHandler;
};

export function GameCanvas(props: GameCanvasProps): ReactElement {
  const {
    huntingLocations,
    onCharacterProfileChange,
    onCollectionChange,
    onHuntCommandSenderChange,
    onHuntStateChange,
    onTransitionChange,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const onHuntCommandSenderChangeRef = useRef(onHuntCommandSenderChange);
  const onHuntStateChangeRef = useRef(onHuntStateChange);
  const onCollectionChangeRef = useRef(onCollectionChange);
  const onCharacterProfileChangeRef = useRef(onCharacterProfileChange);
  const onTransitionChangeRef = useRef(onTransitionChange);
  const sceneRef = useRef<CityScene | null>(null);

  function synchronizeHuntStateHandler(): void {
    onCharacterProfileChangeRef.current = onCharacterProfileChange;
    onHuntStateChangeRef.current = onHuntStateChange;
    onCollectionChangeRef.current = onCollectionChange;
    onHuntCommandSenderChangeRef.current = onHuntCommandSenderChange;
    onTransitionChangeRef.current = onTransitionChange;
  }

  function handleCharacterProfileChange(profile: CharacterProfile): void {
    onCharacterProfileChangeRef.current(profile);
  }

  function handleHuntStateChange(hunt: HuntState | null): void {
    onHuntStateChangeRef.current(hunt);
  }

  function handleCollectionChange(collection: CollectionStateEvent['collection']): void {
    onCollectionChangeRef.current(collection);
  }

  function mountGame(): Cleanup | undefined {
    const container = containerRef.current;
    const session = authStore.getState().session;
    const characterId = session ? getSelectedCharacter(session.user.id) : null;
    if (!container || !characterId) {
      return;
    }
    const scene = new CityScene(
      characterId,
      handleCharacterProfileChange,
      handleCollectionChange,
      handleHuntStateChange,
      onHuntCommandSenderChangeRef.current,
      onTransitionChangeRef.current,
    );
    sceneRef.current = scene;
    const config = {
      antialias: false,
      backgroundColor: '#77777f',
      dom: { createContainer: true, pointerEvents: 'none' },
      height: GAME_HEIGHT,
      parent: container,
      pixelArt: true,
      render: { antialias: false, roundPixels: true },
      roundPixels: true,
      scale: {
        autoCenter: Scale.CENTER_BOTH,
        height: GAME_HEIGHT,
        mode: Scale.ENVELOP,
        width: GAME_WIDTH,
      },
      scene,
      type: AUTO,
      width: GAME_WIDTH,
    };
    const game = new Game(config);
    function unmountGame(): void {
      sceneRef.current = null;
      game.destroy(true);
    }
    return unmountGame;
  }

  useEffect(synchronizeHuntStateHandler, [
    onCharacterProfileChange,
    onCollectionChange,
    onHuntCommandSenderChange,
    onHuntStateChange,
  ]);
  useEffect(mountGame, []);
  useEffect(
    function synchronizeHuntingLocations(): void {
      sceneRef.current?.setHuntingLocations(huntingLocations);
    },
    [huntingLocations],
  );
  return <div className="game-canvas" ref={containerRef} />;
}
