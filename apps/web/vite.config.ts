import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs let the build run under any GitHub Pages path.
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    // Phaser alone is over 1 MB minified; one game chunk is expected.
    chunkSizeWarningLimit: 2000,
  },
});
