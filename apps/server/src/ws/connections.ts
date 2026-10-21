import type { ServerWebSocket } from 'bun';

/**
 * The identity of the account behind a connection.
 *
 * The account is known when the channel is opened, and the result travels with
 * the connection from then on.
 */
export type SocketData = {
  userId: string;
};

/**
 * The code of a connection that was replaced by a newer one.
 *
 * The code is not 1000 on purpose: the client reconnects automatically after
 * a normal closure, and two tabs of the same account would then drop each
 * other in a loop, each one reconnecting right after the other closed it.
 * The client reads this code and stays put.
 */
export const REPLACED_CLOSE_CODE = 4001;
export const REPLACED_CLOSE_REASON = 'replaced by a newer connection';

/**
 * The code of a connection closed because the trainer of the account left.
 */
export const DISCONNECTED_CLOSE_CODE = 1000;
export const DISCONNECTED_CLOSE_REASON = 'trainer disconnected';

/**
 * The registry of the open channels, one per account.
 *
 * The registry lives outside the WebSocket handler because the HTTP routes
 * need it: a command that changes the state has to find the channel of the
 * account to push the new state to it, and a session that ends has to close
 * the channel of the account.
 */
export type ConnectionRegistry = {
  /** Forgets the connection, when it is still the current one of the account. */
  close(ws: ServerWebSocket<SocketData>): void;
  /** Closes the channel of the account and forgets it. */
  disconnect(userId: string, code: number, reason: string): void;
  /** The channel of the account, when there is one. */
  get(userId: string): ServerWebSocket<SocketData> | undefined;
  /** Registers the connection as the channel of the account. */
  open(ws: ServerWebSocket<SocketData>): void;
  /** The connections that have not been heard from for longer than the limit. */
  stale(limitMs: number, now: number): ServerWebSocket<SocketData>[];
  /** Marks the connection as heard from. */
  touch(ws: ServerWebSocket<SocketData>): void;
};

/**
 * The registry of the open channels, one per account.
 *
 * The registry also remembers when each connection was heard from last, so
 * the scanner of the living connections can tell a dead one from a quiet one.
 */
export function createConnectionRegistry(): ConnectionRegistry {
  const connections = new Map<string, ServerWebSocket<SocketData>>();
  const activity = createActivityTracker();

  /**
   * One account, one channel: the newer connection replaces the older one,
   * which is closed with the code of a replaced connection.
   */
  function open(ws: ServerWebSocket<SocketData>): void {
    const userId = ws.data.userId;
    const previous = connections.get(userId);
    if (previous !== undefined) {
      previous.close(REPLACED_CLOSE_CODE, REPLACED_CLOSE_REASON);
      activity.forget(previous);
    }
    connections.set(userId, ws);
    activity.touch(ws);
  }

  /**
   * Only the connection that is still the current one is removed from the
   * registry: a connection that was already replaced does not erase the newer
   * one.
   */
  function close(ws: ServerWebSocket<SocketData>): void {
    const userId = ws.data.userId;
    if (connections.get(userId) === ws) {
      connections.delete(userId);
    }
    activity.forget(ws);
  }

  function disconnect(userId: string, code: number, reason: string): void {
    closeConnection(connections, activity, userId, code, reason);
  }

  function get(userId: string): ServerWebSocket<SocketData> | undefined {
    return connections.get(userId);
  }

  return {
    close,
    disconnect,
    get,
    open,
    stale: activity.stale,
    touch: activity.touch,
  };
}

/**
 * Closes the channel of the account and forgets it.
 */
function closeConnection(
  connections: Map<string, ServerWebSocket<SocketData>>,
  activity: ActivityTracker,
  userId: string,
  code: number,
  reason: string,
): void {
  const ws = connections.get(userId);
  if (ws === undefined) {
    return;
  }
  connections.delete(userId);
  activity.forget(ws);
  ws.close(code, reason);
}

/**
 * The moment each connection was heard from last.
 */
type ActivityTracker = {
  forget(ws: ServerWebSocket<SocketData>): void;
  stale(limitMs: number, now: number): ServerWebSocket<SocketData>[];
  touch(ws: ServerWebSocket<SocketData>): void;
};

function createActivityTracker(): ActivityTracker {
  const lastSeen = new Map<ServerWebSocket<SocketData>, number>();

  function touch(ws: ServerWebSocket<SocketData>): void {
    lastSeen.set(ws, Date.now());
  }

  function forget(ws: ServerWebSocket<SocketData>): void {
    lastSeen.delete(ws);
  }

  /**
   * The connections that went quiet for longer than the limit.
   */
  function stale(limitMs: number, now: number): ServerWebSocket<SocketData>[] {
    const silent: ServerWebSocket<SocketData>[] = [];
    for (const [ws, at] of lastSeen) {
      if (now - at >= limitMs) {
        silent.push(ws);
      }
    }
    return silent;
  }

  return { forget, stale, touch };
}
