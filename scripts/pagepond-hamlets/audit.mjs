export {auditPagepond} from '../pagepond-ground/walk-audit.mjs';
import {auditPagepond} from '../pagepond-ground/walk-audit.mjs';
import fs from 'node:fs';
if(process.argv[1]?.endsWith('pagepond-hamlets/audit.mjs')){const r=auditPagepond();fs.writeFileSync('scripts/pagepond-hamlets/walk-audit.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({checked:r.checked,issues:r.issues.slice(0,30)},null,2));if(r.issues.length)process.exitCode=1;}
