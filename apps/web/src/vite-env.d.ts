interface ImportMetaEnv {
  /** WebSocket address of the game server; defaults to `/ws` on the page's host. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
