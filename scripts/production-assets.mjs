import {readFile, unlink} from 'node:fs/promises';
import {join} from 'node:path';

export function productionAssets() {
  return {
    name: 'prune-unused-public-assets',
    apply: 'build',
    async writeBundle({dir}) {
      // Vite has copied public/ into this output. Leave the original files in
      // place for tests, art generation, and the development server.
      const manifest = await readFile(new URL('./production-asset-exclusions.txt', import.meta.url), 'utf8');
      const files = manifest.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
      for (const file of files) {
        if (!/^(pixi-art|pixi-duck|rive)\//.test(file) || file.includes('\\') ||
            file.split('/').some(part => !part || part === '.' || part === '..')) {
          throw new Error(`Invalid public asset exclusion: ${file}`);
        }
      }
      for (const file of files) {
        try {
          await unlink(join(dir, file));
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
    },
  };
}
