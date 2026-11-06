import {readFileSync, writeFileSync} from 'node:fs';
import {patches, swaps} from './merge.mjs';
const T = process.argv[2];
for (const [rel, f] of Object.entries(patches)) writeFileSync(`${T}/${rel}`, f(readFileSync(`${T}/${rel}`, 'utf8')));
for (const [rel, src] of Object.entries(swaps)) writeFileSync(`${T}/${rel}`, readFileSync(src, 'utf8'));
console.log('merged into', T);
