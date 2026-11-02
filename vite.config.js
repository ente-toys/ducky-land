import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'island-runtime',
    closeBundle() {
      const output = resolve(import.meta.dirname, 'dist');
      mkdirSync(resolve(output, 'rive'), { recursive: true });
      for (const route of ['three', 'three/assets']) {
        mkdirSync(resolve(output, route), { recursive: true });
        cpSync(resolve(output, 'index.html'), resolve(output, route, 'index.html'));
      }
      cpSync(resolve(import.meta.dirname, 'rive/web'), resolve(output, 'rive/web'), { recursive: true });
      cpSync(resolve(import.meta.dirname, 'extracted-assets'), resolve(output, 'extracted-assets'), { recursive: true });
      cpSync(resolve(import.meta.dirname, 'ducky-land-assets.zip'), resolve(output, 'ducky-land-assets.zip'));
    },
  }],
});
