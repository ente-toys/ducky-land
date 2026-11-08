import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const E=JSON.parse(readFileSync('src/pixi/home-expansion.json')),out='../concepts/themes/world-map/bigger';
const at=([x,y])=>[(796+(x-796)*.88-278)/.18,(580+(y-580)*.88-204)/.18];
const centers=[['bakery-cafe',[95,60]],['playground',[685,-45]],['windmill-gardens',[1310,-16]],['orchard',[1643,259]],['lighthouse-point',[1628,943]],['fishing-pier',[1045,1289]],['bandstand-lawn',[55,1002]],['flower-lookout',[-98,480]],['north-meadow',[414,164]],['south-meadow',[546,1100]]];
for(const[id,p]of centers){execFileSync(process.execPath,['scripts/bigger-home-2/render.mjs'],{env:{...process.env,HOME_CROP:[...at(p),.8].join(','),HOME_CROP_NAME:id},stdio:'inherit'});}
writeFileSync(out+'/work-c/crops.json',JSON.stringify(centers.map(([id,p])=>({id,center:at(p),pixelsPerWorldUnit:.8,width:1400,height:1000})),null,2));
