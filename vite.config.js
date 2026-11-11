import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
import {runtimeManifest} from './scripts/globe-svg/runtime-manifest.mjs';
import {productionProxy,productionSignIn} from './scripts/vite-production-proxy.mjs';
import {productionAssets} from './scripts/production-assets.mjs';

export default defineConfig({
  // Serve the homepage directly and let removed routes return 404.
  appType: 'mpa',
  plugins: [react(), productionSignIn(), productionAssets(), {
    name: 'share-theme-walk-data',
    apply: 'build',
    enforce: 'post',
    transform(code, id) {
      if (/\/pixi-art\/globe\/manifest\.json(?:\?|$)/.test(id)) {
        const manifest=JSON.parse(readFileSync(id.split('?')[0],'utf8'));
        return {code:`export default ${JSON.stringify(runtimeManifest(manifest))};`,map:null};
      }
      if (!/\/rive\/web\/themes\/[^/]+\/walk-world\.json$/.test(id)) return;
      const world = JSON.parse(readFileSync(id.replace('walk-world.json', 'world.json'), 'utf8'));
      const walk = JSON.parse(readFileSync(id, 'utf8'));
      const overrides = Object.fromEntries(Object.entries(walk).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(world[key])));
      // Geometry exports remain synchronous for navigation. Shared fields occupy
      // the bundle once instead of repeating each island's world in its walk map.
      const removed = Object.keys(world).filter(key => !(key in walk));
      return {code: `import world from './world.json'; const walk = {...world, ...${JSON.stringify(overrides)}}; ${removed.map(key => `delete walk[${JSON.stringify(key)}];`).join('')} export default walk;`, map: null};
    },
  }],
  server: {host:'127.0.0.1',proxy:productionProxy()},
});
