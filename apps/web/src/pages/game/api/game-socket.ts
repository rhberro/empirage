import { getAccessToken } from '~/shared/auth';

import { connectionErrorMessage, createSocketUrl } from './connection-errors';
import { GAME_PROTOCOL_VERSION, parseGameEvent } from './game-protocol';
import type { GameEvent, HuntClockCommand, InputCommand } from './game-protocol';
import type { HuntCommand } from './hunt-protocol';

const INITIAL_RECONNECT_DELAY = 1_000;
const MAXIMUM_RECONNECT_DELAY = 8_000;
const RECONNECT_JITTER = 250;
const AUTHENTICATION_TIMEOUT = 10_000;
const HUNT_CLOCK_INTERVAL = 7_000;
type GameEventHandler = (event: GameEvent) => void;
type ConnectionHandler = () => void;
type TokenProvider = () => string | null;
type GameSessionOptions = {
  characterId: string;
  onDisconnect: ConnectionHandler;
  onEvent: GameEventHandler;
  tokenProvider?: TokenProvider;
};

export class GameSession {
  private readonly characterId: string;
  private readonly onDisconnect: ConnectionHandler;
  private readonly onEvent: GameEventHandler;
  private readonly tokenProvider: TokenProvider;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private socket: WebSocket | null = null;
  private stopped = true;
  private authenticated = false;
  private authenticationTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private huntClockTimer: ReturnType<typeof globalThis.setInterval> | null = null;

  public constructor(options: GameSessionOptions) {
    this.characterId = options.characterId;
    this.onDisconnect = options.onDisconnect;
    this.onEvent = options.onEvent;
    this.tokenProvider =
      options.tokenProvider === undefined ? getAccessToken : options.tokenProvider;
  }

  public start(): void {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.connect();
  }

  public send(command: InputCommand | HuntClockCommand | HuntCommand): boolean {
    if (
      !this.authenticated ||
      !this.socket ||
      this.socket.readyState !== globalThis.WebSocket.OPEN
    ) {
      return false;
    }
    try {
      this.socket.send(JSON.stringify(command));
      return true;
    } catch {
      this.retry('Falha ao enviar comando. Reconectando…');
      return false;
    }
  }

  public stop(): void {
    this.stopped = true;
    this.authenticated = false;
    this.clearAuthenticationTimer();
    this.stopHuntClock();
    if (this.reconnectTimer !== null) {
      globalThis.clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.close(1000, 'scene shutdown');
    }
  }

  private connect(): void {
    if (this.stopped) {
      return;
    }
    this.reconnectTimer = null;
    let token: string | null;
    let url: string;
    try {
      token = this.tokenProvider();
      url = createSocketUrl();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível iniciar a conexão.';
      this.stop();
      this.report(message);
      return;
    }
    if (!token) {
      this.retry('Sessão indisponível. Aguardando… Se persistir, entre novamente.');
      return;
    }
    this.report('Conectando ao servidor…');
    let socket: WebSocket;
    try {
      socket = new globalThis.WebSocket(url);
    } catch {
      this.retry('WebSocket indisponível. Verifique o endereço e a segurança do servidor.');
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', this.handleOpen.bind(this, socket, token));
    socket.addEventListener('message', this.handleMessage.bind(this, socket));
    socket.addEventListener('close', this.handleClose.bind(this, socket));
    socket.addEventListener('error', this.handleError.bind(this, socket));
    this.authenticationTimer = globalThis.setTimeout(
      this.handleTimeout.bind(this),
      AUTHENTICATION_TIMEOUT,
    );
  }

  private handleOpen(socket: WebSocket, token: string): void {
    if (socket !== this.socket || this.stopped) {
      return;
    }
    this.report('Conectado. Autenticando personagem…');
    const command = {
      characterId: this.characterId,
      token,
      type: 'authenticate' as const,
      version: GAME_PROTOCOL_VERSION,
    };
    try {
      socket.send(JSON.stringify(command));
    } catch {
      this.retry('Falha na autenticação. Reconectando…');
    }
  }

  private handleMessage(socket: WebSocket, message: MessageEvent<string>): void {
    if (socket !== this.socket || this.stopped) {
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(message.data) as unknown;
    } catch {
      this.protocolFailure();
      return;
    }
    const event = parseGameEvent(value);
    if (!event) {
      this.protocolFailure();
      return;
    }
    if (event.type === 'authenticated') {
      this.authenticated = true;
      this.attempt = 0;
      this.clearAuthenticationTimer();
      this.sendHuntClock();
    } else if (event.type === 'hunt_state') {
      if (event.hunt) {
        this.startHuntClock();
      } else {
        this.stopHuntClock();
      }
    } else if (event.type === 'error' && event.code !== 'hunt_command_failed') {
      this.stop();
      this.report(connectionErrorMessage(event.code));
      return;
    }
    this.onEvent(event);
  }

  private handleClose(socket: WebSocket, event: CloseEvent): void {
    if (socket !== this.socket) {
      return;
    }
    this.socket = null;
    if (event.code === 1008 || event.code === 4001) {
      this.stop();
      this.report(connectionErrorMessage(event.reason || String(event.code)));
      return;
    }
    this.retry('Conexão perdida. Reconectando…');
  }

  private retry(message: string): void {
    if (this.stopped) {
      return;
    }
    this.authenticated = false;
    this.clearAuthenticationTimer();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.close();
    }
    this.onDisconnect();
    this.report(message);
    if (this.reconnectTimer !== null) {
      return;
    }
    const exponentialDelay = INITIAL_RECONNECT_DELAY * 2 ** this.attempt;
    const delay =
      Math.min(MAXIMUM_RECONNECT_DELAY, exponentialDelay) + Math.random() * RECONNECT_JITTER;
    this.attempt = Math.min(this.attempt + 1, 10);
    this.reconnectTimer = globalThis.setTimeout(this.connect.bind(this), delay);
  }

  private handleError(socket: WebSocket): void {
    if (socket === this.socket) {
      this.retry('Falha no WebSocket. Verifique rede, servidor e origem permitida. Reconectando…');
    }
  }

  private report(message: string): void {
    const event: GameEvent = { message, type: 'connection_status' };
    this.onEvent(event);
  }

  private protocolFailure(): void {
    this.stop();
    this.report('Resposta inválida ou protocolo incompatível. Recarregue a página.');
  }

  private handleTimeout(): void {
    this.retry('Servidor não confirmou o personagem. Reconectando…');
  }

  private clearAuthenticationTimer(): void {
    if (this.authenticationTimer !== null) {
      globalThis.clearTimeout(this.authenticationTimer);
      this.authenticationTimer = null;
    }
  }

  private sendHuntClock(): void {
    const command: HuntClockCommand = {
      sentAt: Date.now(),
      type: 'hunt_clock',
      version: GAME_PROTOCOL_VERSION,
    };
    this.send(command);
  }

  private startHuntClock(): void {
    if (this.huntClockTimer !== null) {
      return;
    }
    this.sendHuntClock();
    this.huntClockTimer = globalThis.setInterval(
      this.sendHuntClock.bind(this),
      HUNT_CLOCK_INTERVAL,
    );
  }

  private stopHuntClock(): void {
    if (this.huntClockTimer !== null) {
      globalThis.clearInterval(this.huntClockTimer);
      this.huntClockTimer = null;
    }
  }
}
