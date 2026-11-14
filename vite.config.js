import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
import {productionProxy,productionSignIn} from './scripts/vite-production-proxy.mjs';
import {groundMesh} from './scripts/vite-ground-mesh.mjs';
import {prerenderArt} from './scripts/vite-prerender-art.mjs';
import {pruneUnusedArt} from './scripts/vite-prune-art.mjs';

export default defineConfig({
  appType: 'mpa',
  plugins: [react(), productionSignIn(), groundMesh(), prerenderArt(), pruneUnusedArt(), {
    name: 'share-theme-walk-data',
    apply: 'build',
    enforce: 'post',
    transform(code, id) {
      if (!/\/assets\/world\/themes\/[^/]+\/walk-world\.json$/.test(id)) return;
      const world = JSON.parse(readFileSync(id.replace('walk-world.json', 'world.json'), 'utf8'));
      const walk = JSON.parse(readFileSync(id, 'utf8'));
      const overrides = Object.fromEntries(Object.entries(walk).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(world[key])));
      const removed = Object.keys(world).filter(key => !(key in walk));
      return {code: `import world from './world.json'; const walk = {...world, ...${JSON.stringify(overrides)}}; ${removed.map(key => `delete walk[${JSON.stringify(key)}];`).join('')} export default walk;`, map: null};
    },
  }],
  server: {host:'127.0.0.1',proxy:productionProxy()},
});
