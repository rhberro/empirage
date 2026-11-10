import type { ReactElement } from 'react';

import { GameCanvas } from './GameCanvas';

import './game.css';

export function GamePage(): ReactElement {
  return (
    <main className="game-frame">
      <GameCanvas />
    </main>
  );
}
