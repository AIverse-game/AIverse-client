import type { ServerMessage } from '@aiverse/protocol';
import type { GameConnection } from './connection';

/**
 * Runs the authority in a Web Worker. Messages are JSON strings, as they would be
 * on a socket, so nothing that cannot cross a network sneaks into the protocol.
 */
export function createLocalConnection(): GameConnection {
  const worker = new Worker(new URL('../local-server/worker.ts', import.meta.url), { type: 'module' });
  const listeners = new Set<(message: ServerMessage) => void>();
  const failureListeners = new Set<(reason: string) => void>();
  const fail = (reason: string) => {
    for (const listener of failureListeners) listener(`本地服务端出错：${reason}`);
  };

  worker.onmessage = (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as ServerMessage;
    for (const listener of listeners) listener(message);
  };
  // Covers a script that fails to load (404, no module-worker support) and uncaught errors inside it.
  worker.onerror = (event) => {
    console.error('[local-server]', event.message);
    fail(event.message || '本地服务端无法启动');
  };
  worker.onmessageerror = () => fail('本地服务端消息无法解析');

  return {
    send: (message) => worker.postMessage(JSON.stringify(message)),
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onFailure(listener) {
      failureListeners.add(listener);
      return () => failureListeners.delete(listener);
    },
    close: () => worker.terminate(),
  };
}
