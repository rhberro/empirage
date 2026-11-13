import type { Input } from 'phaser';

import type { PlayerInput } from '../lib/player-input';

type HuntRequest = (event: KeyboardEvent) => void;

export function bindCityInput(
  keyboard: Input.Keyboard.KeyboardPlugin,
  playerInput: PlayerInput,
  requestHunt: HuntRequest,
): void {
  const capturedKeys = ['W', 'A', 'S', 'D', 'SHIFT', 'SPACE'];
  function activateNorth(): void {
    playerInput.setDirection('north', true);
  }
  function activateWest(): void {
    playerInput.setDirection('west', true);
  }
  function activateSouth(): void {
    playerInput.setDirection('south', true);
  }
  function activateEast(): void {
    playerInput.setDirection('east', true);
  }
  function deactivateNorth(): void {
    playerInput.setDirection('north', false);
  }
  function deactivateWest(): void {
    playerInput.setDirection('west', false);
  }
  function deactivateSouth(): void {
    playerInput.setDirection('south', false);
  }
  function deactivateEast(): void {
    playerInput.setDirection('east', false);
  }
  function activateRunning(): void {
    playerInput.setRunning(true);
  }
  function deactivateRunning(): void {
    playerInput.setRunning(false);
  }
  keyboard.addCapture(capturedKeys);
  keyboard.on('keydown-W', activateNorth);
  keyboard.on('keydown-A', activateWest);
  keyboard.on('keydown-S', activateSouth);
  keyboard.on('keydown-D', activateEast);
  keyboard.on('keyup-W', deactivateNorth);
  keyboard.on('keyup-A', deactivateWest);
  keyboard.on('keyup-S', deactivateSouth);
  keyboard.on('keyup-D', deactivateEast);
  keyboard.on('keydown-SHIFT', activateRunning);
  keyboard.on('keyup-SHIFT', deactivateRunning);
  keyboard.on('keydown-SPACE', requestHunt);
}
