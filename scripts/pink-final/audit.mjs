// Compatibility entry point: audit the current surface, without legacy exceptions.
export {auditRosy as auditPink} from '../rosy-ground/walk-audit.mjs';
import {auditRosy} from '../rosy-ground/walk-audit.mjs';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=auditRosy();writeFileSync('scripts/pink-final/overlap-audit.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r.checked),r.remaining);if(r.remainingOverlapCount)process.exitCode=1;}
