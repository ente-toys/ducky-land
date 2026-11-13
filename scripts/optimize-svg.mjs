import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export function optimizeSvg(svg) {
  return svg.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*>/g, tag => {
    if (!/^<path\s/.test(tag)) return tag;
    return tag.replace(/(\sd\s*=\s*)(["'])(.*?)\2/gs, (attribute, prefix, quote, path) => {
      if (!/^[MmLlHhVvCcSsQqTtZz\d.,\s+-]*$/.test(path)) return attribute;
      const compact = path.replace(/[+-]?(?:\d+\.\d*|\.\d+|\d+)/g, (number, offset) => {
        if (!number.includes('.')) return number;
        const trimmed = number.replace(/0+$/, '').replace(/\.$/, '');
        const value = /^[+-]?$/.test(trimmed) ? trimmed + '0' : trimmed;
        return value + (path[offset + number.length] === '.' ? ' ' : '');
      });
      return prefix + quote + compact + quote;
    });
  });
}

export async function optimizeSvgDirectory(directory, sourceDirectory = directory) {
  let files = 0, before = 0, after = 0;
  for (const entry of await readdir(sourceDirectory, {withFileTypes: true})) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      const child = await optimizeSvgDirectory(path, `${sourceDirectory}/${entry.name}`);
      files += child.files; before += child.before; after += child.after;
    } else if (entry.name.endsWith('.svg')) {
      const source = await readFile(path, 'utf8');
      const optimized = optimizeSvg(source);
      before += Buffer.byteLength(source); after += Buffer.byteLength(optimized);
      if (source !== optimized) { await writeFile(path, optimized); files++; }
    }
  }
  return {files, before, after};
}

export function losslessSvgBuild() {
  let output, publicDirectory;
  return {
    name: 'lossless-svg-build',
    apply: 'build',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
      publicDirectory = config.publicDir;
    },
    async closeBundle() {
      const {files, before, after} = await optimizeSvgDirectory(output, publicDirectory);
      console.log(`SVG cleanup: ${files} files, ${before} → ${after} bytes (${before - after} saved).`);
    },
  };
}
