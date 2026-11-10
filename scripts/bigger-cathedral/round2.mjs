// Restricted Bellovo follow-up: no shared cache, registry, globe or build writes.
// New artwork URLs use the generic raster viewport fallback until shared cache
// metadata is refreshed by the integrator. The manifest opts into that loader.
import {execFileSync} from 'node:child_process';
for(const script of ['buildings','centre-art','life','centre-A'])
 execFileSync(process.execPath,[`scripts/bigger-cathedral/${script}.mjs`],{stdio:'inherit'});
