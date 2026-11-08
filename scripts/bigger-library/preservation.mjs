// Walking-scale preservation check, in addition to the complete-island overview.
import {render} from './render.mjs';import fs from 'node:fs';import sharp from 'sharp';
import {original} from './model.mjs';import {inShape} from '../../rive/web/island-geometry.mjs';
const checks=[];
for(const [id,x,y]of [['north-shore',5000,850],['west-shore',950,2600]]){
 const crop={x,y,k:.8,w:1400,h:1000};
 const before=await render({old:true,crop}),after=await render({built:true,crop});
 const [A,B]=await Promise.all([before,after].map(buf=>sharp(buf).ensureAlpha().raw().toBuffer()));
 let checked=0,changed=0,maxChannelChange=0;
 const ox=x-1400/1.6,oy=y-1000/1.6;
 for(let yy=0;yy<1000;yy++)for(let xx=0;xx<1400;xx++){
  const wx=ox+(xx+.5)/.8,wy=oy+(yy+.5)/.8;
  if(!original.world.coastRings.some(poly=>inShape(wx,wy,{poly},-12)))continue;
  checked++;const i=(yy*1400+xx)*4;
  if(!A.subarray(i,i+4).equals(B.subarray(i,i+4))){changed++;maxChannelChange=Math.max(maxChannelChange,...[0,1,2].map(c=>Math.abs(A[i+c]-B[i+c])));}
 }
 checks.push({id,crop,insetWorldUnits:12,checked,changed,maxChannelChange});
}
fs.writeFileSync('scripts/bigger-library/preservation-closeups.json',JSON.stringify(checks,null,2)+'\n');
console.log(checks);
if(checks.some(c=>c.changed))throw Error('Walking-scale original art changed');
