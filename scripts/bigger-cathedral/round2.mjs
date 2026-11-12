import {execFileSync} from 'node:child_process';
for(const script of ['buildings','centre-art','life','centre-A'])
 execFileSync(process.execPath,[`scripts/bigger-cathedral/${script}.mjs`],{stdio:'inherit'});
