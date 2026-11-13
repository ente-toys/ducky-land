#!/usr/bin/env node
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {mapFor} from '../../src/world/island-maps.js';
import {WORLD_ISLANDS} from '../../src/world/world-map.js';
import {homeLayers} from '../globe-perf/snapshot.mjs';
import {verifySourceSnapshot} from './sources.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../../public/pixi-art/globe/manifest.json',import.meta.url)));
const problems=[];
for(const theme of new Set(WORLD_ISLANDS.map(i=>i.theme??'home'))){
 const map=mapFor(theme),art=map.home?homeLayers():JSON.parse(fs.readFileSync(root+'public'+map.art));
 problems.push(...verifySourceSnapshot(root,theme,manifest[theme],{map,art}));
}
if(problems.length){console.error('Stale globe previews:\n'+problems.map(p=>'  '+p).join('\n')+'\nRebuild the listed themes with node scripts/globe-svg/build.mjs THEME.');process.exitCode=1;}
else console.log('Globe preview sources and generated SVGs are current.');
