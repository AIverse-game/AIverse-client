import { createLocalServer, LOCAL_VIEWER_ID } from './server';

// The DOM lib types `self` as a Window; only these worker members are used.
interface WorkerScope {
  postMessage(message: string): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
}

const scope = self as unknown as WorkerScope;

const host = createLocalServer({
  seed: crypto.getRandomValues(new Uint32Array(1))[0]!,
  scheduler: {
    now: () => performance.now(),
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle as number),
  },
  onError: (error) => console.error('[local-server] match aborted', error),
});

const session = host.connect(
  { send: (message) => scope.postMessage(JSON.stringify(message)) },
  { viewerId: LOCAL_VIEWER_ID },
);

scope.onmessage = (event) => {
  session.receive(decode(event.data));
};

function decode(data: unknown): unknown {
  if (typeof data !== 'string') return undefined;
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}
