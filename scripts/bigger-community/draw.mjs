import fs from 'node:fs';import {render,OUT} from './render.mjs';
const p=JSON.parse(fs.readFileSync('scripts/bigger-community/plan.json')),a=JSON.parse(fs.readFileSync('scripts/bigger-community/design-art.json'));
await render(a,p.harbor,OUT+'/community-bigger.png',{labels:p.places});console.log('Drawing saved before production data changes.');
