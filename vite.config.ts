import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/  ·  https://vitest.dev/config/
// The `test` block is typed via "vitest/config" in tsconfig.node.json.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
