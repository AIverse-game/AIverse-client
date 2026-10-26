import { parseServerMessage, type ServerMessage } from '@aiverse/protocol';
import type { GameConnection } from './connection';

/** The parts of the browser WebSocket this module uses; tests pass a fake. */
export type SocketLike = Pick<WebSocket, 'readyState' | 'onopen' | 'onmessage' | 'onclose' | 'send' | 'close'>;

const CONNECTING = 0;
const OPEN = 1;

/** Same host as the page; the dev and preview servers proxy `/ws` to the Python server. */
export function defaultServerUrl(location: { protocol: string; host: string }): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
}

/**
 * Connects to the authoritative server. Messages sent before the socket opens are
 * queued; anything the server sends is validated against the protocol first.
 */
export function createWebSocketConnection(
  url: string,
  openSocket: (url: string) => SocketLike = (target) => new WebSocket(target),
): GameConnection {
  let socket: SocketLike;
  try {
    socket = openSocket(url);
  } catch (error) {
    return failedConnection(`服务端地址无效（${url}）：${error instanceof Error ? error.message : String(error)}`);
  }
  const pending: string[] = [];
  const listeners = new Set<(message: ServerMessage) => void>();
  const failureListeners = new Set<(reason: string) => void>();
  let opened = false;
  let finished = false;

  const fail = (reason: string) => {
    if (finished) return;
    finished = true;
    for (const listener of failureListeners) listener(reason);
    socket.close();
  };

  socket.onopen = () => {
    opened = true;
    for (const frame of pending.splice(0)) socket.send(frame);
  };
  socket.onmessage = (event) => {
    if (finished) return;
    let raw: unknown;
    try {
      raw = typeof event.data === 'string' ? JSON.parse(event.data) : undefined;
    } catch {
      raw = undefined;
    }
    const parsed = parseServerMessage(raw);
    if (!parsed.ok) {
      console.error('[server] unexpected message', event.data);
      fail(`服务端消息不符合协议：${parsed.error}`);
      return;
    }
    for (const listener of listeners) listener(parsed.value);
  };
  // Browsers always follow a socket error with close, so close is the single failure path.
  socket.onclose = () => fail(opened ? '与服务端的连接已断开' : `无法连接服务端（${url}）`);

  return {
    send(message) {
      const frame = JSON.stringify(message);
      if (socket.readyState === OPEN) socket.send(frame);
      else if (socket.readyState === CONNECTING) pending.push(frame);
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onFailure(listener) {
      failureListeners.add(listener);
      return () => failureListeners.delete(listener);
    },
    close() {
      finished = true;
      socket.close();
    },
  };
}

/** A connection that never opened. Failure is reported after listeners have had a chance to attach. */
function failedConnection(reason: string): GameConnection {
  const failureListeners = new Set<(reason: string) => void>();
  void Promise.resolve().then(() => {
    for (const listener of failureListeners) listener(reason);
  });
  return {
    send: () => {},
    onMessage: () => () => {},
    onFailure(listener) {
      failureListeners.add(listener);
      return () => failureListeners.delete(listener);
    },
    close: () => failureListeners.clear(),
  };
}
