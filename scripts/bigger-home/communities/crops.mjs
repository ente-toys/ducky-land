import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const P=JSON.parse(readFileSync(new URL('./plan.json',import.meta.url))),O='../concepts/themes/world-map/bigger';
const at=([x,y])=>[(x-278)/.18,(y-204)/.18];
const crops=[...P.communities.map(c=>[c.id,c.crop]),['road-junction',[303,322]],['village-lane',[307,177]],['north-common',[454,241]],['south-common',[659,1079]]];
for(const[id,p]of crops)execFileSync(process.execPath,['scripts/bigger-home/communities/render.mjs'],{env:{...process.env,HOME_CROP:[...at(p),.8].join(','),HOME_CROP_NAME:id},stdio:'inherit'});
writeFileSync(O+'/home-community-work/crops.json',JSON.stringify(crops.map(([id,p])=>({id,center:at(p),pixelsPerWorldUnit:.8,width:1400,height:1000})),null,2));
