import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      if (fs.existsSync(dist)) {
        const glbSrc = path.resolve(__dirname, 'Full_Foot.glb');
        const glbDest = path.resolve(dist, 'Full_Foot.glb');
        if (fs.existsSync(glbSrc)) {
          fs.copyFileSync(glbSrc, glbDest);
        }
        const texSrc = path.resolve(__dirname, 'bone-texture');
        const texDest = path.resolve(dist, 'bone-texture');
        if (fs.existsSync(texSrc)) {
          fs.cpSync(texSrc, texDest, { recursive: true });
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [copyStaticAssets()],
  server: {
    port: 8080,
    open: false,
    watch: {
      ignored: [
        '**/dist/**',
        '**/example_nodes/**',
        '**/*.glb',
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
