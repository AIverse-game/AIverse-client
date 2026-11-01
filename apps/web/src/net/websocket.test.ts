import type { ServerMessage } from '@aiverse/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createWebSocketConnection, defaultServerUrl, type SocketLike } from './websocket';

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closeCalls = 0;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closeCalls++;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(data: unknown) {
    this.onmessage?.({ data });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

function setup() {
  const socket = new FakeSocket();
  const connection = createWebSocketConnection('ws://test/ws', () => socket as unknown as SocketLike);
  const messages: ServerMessage[] = [];
  const failures: string[] = [];
  connection.onMessage((m) => messages.push(m));
  connection.onFailure((r) => failures.push(r));
  return { socket, connection, messages, failures };
}

const STATE = {
  type: 'state',
  world: { map: { size: 10 }, pools: [], residents: [], game: { ended: false, remainingSeconds: 60 }, speech: [], offers: [], contractProposals: [], contracts: [], rigs: [], rigRules: { price: 9000, capacity: 4, cycleSeconds: 20, yieldMultiplier: 2, rentPer100: 50, energyPer100: 20 } },
};

describe('createWebSocketConnection', () => {
  it('queues messages until the socket opens', () => {
    const { socket, connection } = setup();
    connection.send({ type: 'hello', protocolVersion: 2 });
    expect(socket.sent).toEqual([]);
    socket.open();
    connection.send({ type: 'hello', protocolVersion: 3 });
    expect(socket.sent.map((frame) => JSON.parse(frame))).toEqual([
      { type: 'hello', protocolVersion: 2 },
      { type: 'hello', protocolVersion: 3 },
    ]);
  });

  it('delivers valid server messages', () => {
    const { socket, messages, failures } = setup();
    socket.open();
    socket.receive(JSON.stringify(STATE));
    expect(messages).toEqual([STATE]);
    expect(failures).toEqual([]);
  });

  it.each([
    ['non-JSON text', 'nope'],
    ['a binary frame', new ArrayBuffer(1)],
    ['an out-of-protocol message', JSON.stringify({ ...STATE, world: { map: { size: -1 }, residents: [] } })],
  ])('fails once and closes on %s', (_, data) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { socket, messages, failures } = setup();
    socket.open();
    socket.receive(data);
    socket.receive(JSON.stringify(STATE));
    socket.drop();
    expect(messages).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/不符合协议/);
    expect(socket.closeCalls).toBeGreaterThan(0);
  });

  it('tells an unreachable server apart from a dropped connection', () => {
    const unreachable = setup();
    unreachable.socket.drop();
    expect(unreachable.failures).toEqual(['无法连接服务端（ws://test/ws）']);

    const dropped = setup();
    dropped.socket.open();
    dropped.socket.drop();
    expect(dropped.failures).toEqual(['与服务端的连接已断开']);
  });

  it('does not report a failure when the client closes the connection itself', () => {
    const { socket, connection, failures } = setup();
    socket.open();
    connection.close();
    socket.drop();
    expect(failures).toEqual([]);
  });
});

describe('an unusable server URL', () => {
  it('is reported as a failure instead of throwing', async () => {
    const connection = createWebSocketConnection('localhost:8000/ws', () => {
      throw new SyntaxError('invalid URL');
    });
    const failures: string[] = [];
    connection.onFailure((reason) => failures.push(reason));
    connection.send({ type: 'hello', protocolVersion: 2 });
    await Promise.resolve();
    expect(failures).toEqual(['服务端地址无效（localhost:8000/ws）：invalid URL']);
  });
});

describe('defaultServerUrl', () => {
  it('uses the page host and a matching scheme', () => {
    expect(defaultServerUrl({ protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/ws');
    expect(defaultServerUrl({ protocol: 'https:', host: 'example.com' })).toBe('wss://example.com/ws');
  });
});
