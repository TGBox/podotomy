/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    open: false
  },
  assetsInclude: ['**/*.glb', '**/*.png'],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.{test,spec}.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});
