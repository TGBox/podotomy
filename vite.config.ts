import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      if (fs.existsSync(dist)) {
        const glbSrc = path.resolve(__dirname, 'bones_foot.glb');
        const glbDest = path.resolve(dist, 'bones_foot.glb');
        if (fs.existsSync(glbSrc)) {
          fs.copyFileSync(glbSrc, glbDest);
        }
        const skinGlbSrc = path.resolve(__dirname, 'skin_foot.glb');
        const skinGlbDest = path.resolve(dist, 'skin_foot.glb');
        if (fs.existsSync(skinGlbSrc)) {
          fs.copyFileSync(skinGlbSrc, skinGlbDest);
        }
        const texSrc = path.resolve(__dirname, 'bone-texture');
        const texDest = path.resolve(dist, 'bone-texture');
        if (fs.existsSync(texSrc)) {
          fs.cpSync(texSrc, texDest, { recursive: true });
        }
        const skinSrc = path.resolve(__dirname, 'skin-texture');
        const skinDest = path.resolve(dist, 'skin-texture');
        if (fs.existsSync(skinSrc)) {
          fs.cpSync(skinSrc, skinDest, { recursive: true });
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
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/skin_*/**',
        '**/bone-texture/**',
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
