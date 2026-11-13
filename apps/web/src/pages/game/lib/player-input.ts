import { GAME_PROTOCOL_VERSION } from '../api/game-protocol';
import type { Direction, InputCommand, InputState, ProtocolDirection } from '../api/game-protocol';

const INPUT_REFRESH_INTERVAL = 1_000;
type Directions = Array<Direction>;
const DIRECTIONS: Directions = ['north', 'west', 'south', 'east'];
const PROTOCOL_DIRECTIONS: Record<Direction, ProtocolDirection> = {
  east: 'right',
  north: 'up',
  south: 'down',
  west: 'left',
};
type InputSender = (command: InputCommand) => boolean;

export class PlayerInput {
  public enabled = true;
  private readonly active: Record<Direction, boolean> = {
    east: false,
    north: false,
    south: false,
    west: false,
  };
  private readonly priority: Directions = [];
  private readonly send: InputSender;
  private refreshTimer: ReturnType<typeof globalThis.setInterval> | null = null;
  private running = false;
  private sequence = 0;

  public constructor(send: InputSender) {
    this.send = send;
  }

  public setDirection(direction: Direction, active: boolean): void {
    if (!this.enabled) {
      return;
    }
    if (this.active[direction] === active) {
      return;
    }
    this.active[direction] = active;
    const index = this.priority.indexOf(direction);
    if (index >= 0) {
      this.priority.splice(index, 1);
    }
    if (active) {
      this.priority.unshift(direction);
    }
    this.sendCurrent();
    this.updateRefresh();
  }

  public setRunning(running: boolean): void {
    if (!this.enabled) {
      return;
    }
    if (this.running === running) {
      return;
    }
    this.running = running;
    this.sendCurrent();
    this.updateRefresh();
  }

  public neutralize(): void {
    const wasActive = this.running || DIRECTIONS.some(this.isActive, this);
    for (const direction of DIRECTIONS) {
      this.active[direction] = false;
    }
    this.priority.length = 0;
    this.running = false;
    this.updateRefresh();
    if (wasActive) {
      this.sendCurrent();
    }
  }

  public destroy(): void {
    this.neutralize();
    if (this.refreshTimer !== null) {
      globalThis.clearInterval(this.refreshTimer);
    }
    this.refreshTimer = null;
  }

  private sendCurrent(): void {
    this.sequence += 1;
    const input: InputState = {
      down: this.active.south,
      left: this.active.west,
      right: this.active.east,
      running: this.running,
      up: this.active.north,
    };
    const firstPriority = this.priority[0];
    const preferred = firstPriority === undefined ? 'south' : firstPriority;
    const command = {
      input,
      priority: PROTOCOL_DIRECTIONS[preferred],
      sequence: this.sequence,
      type: 'input' as const,
      version: GAME_PROTOCOL_VERSION,
    };
    this.send(command);
  }

  private refresh(): void {
    if (this.running || DIRECTIONS.some(this.isActive, this)) {
      this.sendCurrent();
    }
  }

  private updateRefresh(): void {
    const relevant = this.running || DIRECTIONS.some(this.isActive, this);
    if (relevant && this.refreshTimer === null) {
      this.refreshTimer = globalThis.setInterval(this.refresh.bind(this), INPUT_REFRESH_INTERVAL);
    } else if (!relevant && this.refreshTimer !== null) {
      globalThis.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private isActive(direction: Direction): boolean {
    return this.active[direction];
  }
}
