import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: 'public',
  server: {
    port: 8080,
    open: false,
    watch: {
      ignored: [
        '**/dist/**',
        '**/example_nodes/**',
        '**/public/**',
        '**/*.glb',
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/test-results/**',
        '**/playwright-report/**'
      ]
    }
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
