// Local reading-pond finish. Reapply after a ground rebuild without repainting paths.
import fs from 'node:fs';
import {contours} from '../pagepond/geometry.mjs';

const A='public/pixi-art/themes/library/';
export const waterPath='M4452 3068 C4490 3034 4540 3024 4580 3010 C4630 2992 4660 2946 4710 2950 C4775 2954 4790 2990 4840 2998 C4880 3005 4930 2994 4960 3026 C4992 3060 4978 3088 4994 3120 C5015 3160 5022 3190 4996 3224 C4972 3254 4928 3252 4894 3272 C4860 3294 4838 3328 4796 3328 C4745 3336 4720 3304 4668 3308 C4614 3312 4580 3318 4548 3292 C4510 3264 4524 3238 4494 3220 C4458 3200 4428 3170 4436 3134 C4442 3104 4434 3090 4452 3068 Z';
export const pondMarkup=`<g id="pagepond-reading-pond" data-bank="grass-separated-from-river">
  <path d="${waterPath}" fill="#87b431" stroke="#87b431" stroke-width="48"/>
  <path d="${waterPath}" fill="#6ec9de" stroke="#bad27b" stroke-width="8"/>
  <path d="M4452 3077 C4500 3038 4540 3046 4586 3028 M4652 2986 Q4682 2962 4712 2966 M4890 3020 Q4926 3016 4946 3038" fill="none" stroke="#b5e7f7" stroke-width="6"/>
  <path d="M4968 3216 Q4946 3239 4910 3243 M4840 3294 Q4818 3314 4785 3310 M4550 3256 Q4536 3240 4528 3227" fill="none" stroke="#8fd6e6" stroke-width="10"/>
  <path d="M4406 3126l-9-12m9 12 4-17 M4513 3024l-3-14m3 14 9-9 M4828 2959l-4-13m4 13 8-8 M5040 3172l-3-15m3 15 8-9 M4889 3324l6-13m-6 13-7-7" fill="none" stroke="#39472d" stroke-width="2.5"/>
  <path d="M4480 3194q8-9 18-3 M4958 3078q8-9 17-3 M4610 2958q8-7 15-2" fill="none" stroke="#bad27b" stroke-width="5"/>
</g>`;

const legacy=/<ellipse\b[^>]*\bcx="4692"\s+cy="3138"[^>]*\/>\s*<ellipse\b[^>]*\bcx="4692"\s+cy="3138"[^>]*\/>\s*<ellipse\b[^>]*\bcx="4692"\s+cy="3138"[^>]*\/>\s*<ellipse\b[^>]*\bcx="4692"\s+cy="3138"[^>]*\/>\s*<path\b[^>]*\bd="M4467\.36 3075\.6 Q4692 2971\.6 4899\.36 3065\.2"[^>]*\/>/;
function replacePond(file){
 const before=fs.readFileSync(file,'utf8');
 const after=before.includes('id="pagepond-reading-pond"')?before.replace(/<g id="pagepond-reading-pond"[\s\S]*?<\/g>/,pondMarkup):before.replace(legacy,pondMarkup);
 if(!after.includes(pondMarkup))throw Error('Missing reading pond in '+file);
 if(after!==before)fs.writeFileSync(file,after);
}
// Only the tile whose viewBox intersects this pond needs a runtime edit. The
// authoring master keeps future ground rebuilds consistent with that tile.
replacePond('scripts/pagepond-ground/data/centre-ground.svg');
replacePond(A+'ground.svg');
const art=JSON.parse(fs.readFileSync(A+'art.json'));
for(const t of art.ground.tiles)if(t.src.includes('original-ground-')&&t.x<5065&&t.x+t.width>4390&&t.y<3360&&t.y+t.height>2920)replacePond(A+t.src);

// The exact SVG bank drives water collision on both client and server.
const pond={name:'Pagepond reading pond',poly:contours(waterPath,4)[0]};
for(const file of ['world.json','walk-world.json']){
 const path='rive/web/themes/library/'+file,w=JSON.parse(fs.readFileSync(path));
 const i=w.water.findIndex(q=>q.name===pond.name||(q.x===4692&&q.y===3138));
 if(i<0)throw Error('Missing pond collision in '+path);
 w.water[i]=pond;fs.writeFileSync(path,JSON.stringify(w)+'\n');
}
