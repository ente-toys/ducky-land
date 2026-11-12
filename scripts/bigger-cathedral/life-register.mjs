import fs from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
const report=checkTheme('cathedral');
if(!report.ready)throw Error(report.problems.join('\n'));
const file='assets/world/themes/index.js',text=fs.readFileSync(file,'utf8');
const row=`  cathedral: {world: cathedralWorld, walk: cathedralWalk, harbor: cathedralHarbor, art: '/pixi-art/themes/cathedral/art.json', sea: ${JSON.stringify(report.sea)}, sleepers: ${JSON.stringify(report.sleepers)}},`;
if(!/^  cathedral:.*$/m.test(text))throw Error('Cathedral registry row missing');
fs.writeFileSync(file,text.replace(/^  cathedral:.*$/m,row));
console.log('Cathedral registry: '+report.sleepers.length+' valid residents');
