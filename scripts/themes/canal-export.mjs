import {copyFileSync,existsSync,mkdirSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
const art='public/pixi-art/themes/canal',work='../concepts/themes/work/canal';
mkdirSync(work,{recursive:true});const moved=[];
for(const file of readdirSync(art,{recursive:true}))if(/\.png$/i.test(file)){
 const dst=join(work,file);mkdirSync(dirname(dst),{recursive:true});renameSync(join(art,file),dst);moved.push(file);
}
const final=join(work,'final/canal-closeups-vs-home.png');
if(existsSync(final))copyFileSync(final,join(work,'canal-closeups-vs-home.png'));
writeFileSync(join(art,'export-status.json'),JSON.stringify({job:'ten-canal',status:'saved',evidenceDirectory:'concepts/themes/work/canal/',publicRasterFiles:0,moved},null,2));
console.log('Canal PNG evidence is outside public:',work);
