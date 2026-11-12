import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {checkTheme} from '../theme-index.mjs';
const run=(exe,args)=>execFileSync(exe,args,{stdio:'inherit'});
// Resolve the current population before touching ground. Other authored work survives.
fs.writeFileSync('scripts/pagepond-ground/data/current-sleepers.json',JSON.stringify(checkTheme('library').sleepers)+'\n');
const python=process.env.PAGEPOND_PYTHON??'python3';
run(python,['scripts/pagepond-ground/surfaces.py']);
run(python,['scripts/pagepond-ground/buildings.py']);
// Preserve integrated planting-job terrain and single-shadow ownership on rebuilds.
if(JSON.parse(fs.readFileSync('public/pixi-art/themes/library/art.json')).props.some(p=>p.id==='page-b-hill-telescope')){
 run(python,['scripts/pagepond-b/ground.py']);
 const shadows=JSON.parse(fs.readFileSync('scripts/pagepond-b/shadows.json'));
 for(const p of shadows.stripBakedGroundShadows){let svg=fs.readFileSync(p.file,'utf8');svg=svg.replace(p.exactElement,'').replace(p.exactElement.replace('/>',' />'),'');fs.writeFileSync(p.file,svg);}
}

run(process.execPath,['scripts/pagepond-pond/apply.mjs']);
run(process.execPath,['scripts/pagepond-benches/build.mjs']);
run(process.execPath,['scripts/pagepond-boats/build.mjs']);
run(process.execPath,['scripts/pagepond-meadow/install.mjs']);
run(process.execPath,['scripts/theme-index.mjs']);
const a=JSON.parse(fs.readFileSync('public/pixi-art/themes/library/art.json'));
fs.writeFileSync('assets/world/themes/library/placements.json',JSON.stringify(a.props)+'\n');
run(process.execPath,['scripts/pagepond-ground/bridges.mjs']);
run(python,["scripts/pagepond-ground/geometry-audit.py"]);
const checked=checkTheme('library');if(!checked.ready)throw Error(checked.problems.join('\n'));
