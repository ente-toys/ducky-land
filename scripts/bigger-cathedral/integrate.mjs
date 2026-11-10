// Surgical rebuild in dependency order. Legacy source snapshots never replace
// another package's current outputs. No build, commit or publishing side effect.
import {execFileSync} from 'node:child_process';
for(const script of ['buildings','paths','water-art','bridges','centre-art','life','round2-grass','life-register'])
 execFileSync(process.execPath,[`scripts/bigger-cathedral/${script}.mjs`],{stdio:'inherit'});
for(const script of ['source-sizes','raster-bounds','tile-large-art'])
 execFileSync(process.execPath,[`scripts/globe-perf/${script}.mjs`,'cathedral'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/globe-svg/build.mjs','cathedral'],{stdio:'inherit'});
