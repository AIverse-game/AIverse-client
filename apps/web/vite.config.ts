import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // The Python server (aiverse-server) listens on 8000 by default; dev and preview forward
  // the page's `/ws` to it so the client needs no hard-coded address. If the server runs
  // elsewhere, start with AIVERSE_SERVER_PORT=9000 (shell or .env).
  const port = loadEnv(mode, '.', 'AIVERSE_').AIVERSE_SERVER_PORT || '8000';
  const proxy = { '/ws': { target: `ws://127.0.0.1:${port}`, ws: true } };

  return {
    // Relative asset URLs let the build be served from any path.
    base: './',
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
    build: {
      // Phaser alone is over 1 MB minified; one game chunk is expected.
      chunkSizeWarningLimit: 2000,
    },
  };
});
