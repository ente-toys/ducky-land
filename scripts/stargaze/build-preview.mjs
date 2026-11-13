import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root = new URL('../../',import.meta.url);
const result = await build({
  absWorkingDir:fileURLToPath(root),entryPoints:['scripts/stargaze/preview.jsx'],bundle:true,write:false,
  minify:true,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
});
const font = await readFile(new URL('public/fonts/neuton/neuton-latin-400.woff2',root));
const css = (await readFile(new URL('src/app/pixi.css',root),'utf8'))
  .replace('/fonts/neuton/neuton-latin-400.woff2', `data:font/woff2;base64,${font.toString('base64')}`);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Duckyland · Telescope preview</title><style>html,body{margin:0;height:100%;background:#0c1412}#root{height:100%;display:grid;place-items:center}${css}</style><div id="root"></div><script>${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`;
await mkdir(new URL('review/stargaze/',root),{recursive:true});
await writeFile(new URL('review/stargaze/telescope-preview.html',root),html);
console.log('Built review/stargaze/telescope-preview.html (offline fixture: 30,088 stars, 2 online).');
