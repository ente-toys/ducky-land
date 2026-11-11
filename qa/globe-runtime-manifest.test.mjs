import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runtimeManifest} from '../scripts/globe-svg/runtime-manifest.mjs';
import config from '../vite.config.js';
test('production globe manifest retains art/cache keys without shipping build provenance',()=>{
 const full=JSON.parse(fs.readFileSync('public/pixi-art/globe/manifest.json'));
 const compact=runtimeManifest(full);
 for(const [id,entry]of Object.entries(full))assert.deepEqual(compact[id],{src:entry.src,sha256:entry.sha256,width:entry.width,height:entry.height});
 assert.ok(JSON.stringify(compact).length<3000);
 const plugin=config.plugins.find(p=>p.name==='share-theme-walk-data');
 const transformed=plugin.transform('',process.cwd()+'/public/pixi-art/globe/manifest.json');
 assert.ok(!transformed.code.includes('sources'));assert.ok(!transformed.code.includes('modelSha256'));
 assert.ok(transformed.code.includes(compact.home.sha256));
});
