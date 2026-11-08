import {execFileSync} from 'node:child_process';
for(const script of ['source-sizes','tile-large-art','build-previews'])execFileSync(process.execPath,[`scripts/globe-perf/${script}.mjs`],{stdio:'inherit'});
