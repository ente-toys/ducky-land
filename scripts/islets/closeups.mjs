import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {unlinkSync} from 'node:fs';
const outfile='scripts/islets/.closeups-cpu.mjs';
try{
 await build({entryPoints:['scripts/islets/closeups-cpu.mjs'],outfile,bundle:true,platform:'node',packages:'external',format:'esm',external:['../../node_modules/*']});
 execFileSync(process.execPath,[outfile],{stdio:'inherit'});
}finally{try{unlinkSync(outfile);}catch{}}
