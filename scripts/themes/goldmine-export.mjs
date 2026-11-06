// Working PNGs belong outside public. Preserve their relative folders when archiving.
import {readdirSync,mkdirSync,renameSync} from 'node:fs';
import {join,dirname} from 'node:path';
const source='public/pixi-art/themes/goldmine',work='../concepts/themes/work/goldmine';
function visit(dir,relative=''){
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const local=join(relative,entry.name),file=join(dir,entry.name);
  if(entry.isDirectory())visit(file,local);
  else if(/\.png$/i.test(entry.name)){const target=join(work,local);mkdirSync(dirname(target),{recursive:true});renameSync(file,target);console.log('Moved',local);}
 }
}
visit(source);
