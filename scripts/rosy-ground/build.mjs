import {execFileSync} from 'node:child_process';
const run=(exe,args)=>execFileSync(exe,args,{stdio:'inherit'});
run('python3',['scripts/rosy-ground/surfaces.py']);
run(process.execPath,['scripts/rosy-ground/bridges.mjs']);
run('python3',['scripts/rosy-ground/apply.py']);
run(process.execPath,['scripts/theme-index.mjs']);
run(process.execPath,['scripts/globe-perf/source-sizes.mjs','pink']);
run(process.execPath,['scripts/globe-perf/tile-large-art.mjs','pink']);
run(process.execPath,['scripts/globe-svg/build.mjs','pink']);
