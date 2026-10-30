import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages: the game, and the open-world prototype.
export default defineConfig({
  build: { rollupOptions: { input: { main: resolve('index.html'), world: resolve('world.html') } } },
});
