import {readFile,writeFile} from 'node:fs/promises';

// Project a rigid lens plane edge-on at a true +/-90 degree profile.
// Coordinates use the same ground-relative frame as duck.js and the manifest.
const root=new URL('../',import.meta.url);
const manifestURL=new URL('public/pixi-duck/manifest.json',root);
const manifest=JSON.parse(await readFile(manifestURL,'utf8'));
const ink='#232323';
const n=x=>Number(x.toFixed(3));
const path=(d,fill='none',stroke=ink,width=6)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rect=(x,y,w,h,r,fill,stroke=ink,sw=5)=>`<rect x="${n(x)}" y="${n(y)}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
for(const entry of manifest.wardrobe){
  if(entry.slot!=='shades'||![2,8,13,14,15,16].includes(entry.sourceNumber))continue;
  for(const angle of [-90,90]){
    const view=manifest.views.find(v=>v.angle===angle);
    const eye=view.parts.find(p=>p.role==='eye');
    const sign=Math.sign(angle),cx=n(eye.pivot[0]-view.ground[0]+sign*12),cy=n(eye.pivot[1]-view.ground[1]);
    const headCenter=(view.attachments.head[0]+view.attachments.head[1])/2;
    const back=n(headCenter+sign*25),hinge=n(cx-sign*3),arm=entry.sourceNumber===2||entry.sourceNumber===8?'#AF6734':ink;
    let art=path(`M ${hinge} ${n(cy-3)} Q ${n((hinge+back)/2)} ${n(cy-9)} ${back} ${n(cy-5)} Q ${n(back-sign*5)} ${n(cy-4)} ${n(back-sign*6)} ${n(cy+6)}`,'none',arm,entry.sourceNumber===15?8:6);
    const temple=art;
    switch(entry.sourceNumber){
      case 2:
        art+=`<ellipse cx="${cx}" cy="${cy}" rx="25" ry="30" fill="#393535" stroke="#AF6734" stroke-width="7"/>`;
        art+=path(`M ${n(cx-9)} ${n(cy-16)} L ${n(cx-15)} ${n(cy-3)}`,'none','#FFFFFF',4);break;
      case 8:{
        const d=`M ${cx} ${n(cy+31)} C ${n(cx-38)} ${n(cy+5)} ${n(cx-29)} ${n(cy-35)} ${n(cx-12)} ${n(cy-29)} Q ${cx} ${n(cy-25)} ${cx} ${n(cy-16)} Q ${cx} ${n(cy-25)} ${n(cx+12)} ${n(cy-29)} C ${n(cx+29)} ${n(cy-35)} ${n(cx+38)} ${n(cy+5)} ${cx} ${n(cy+31)} Z`;
        art+=path(d,'#393535','#AF6734',6);break;}
      case 13:{
        const points=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,k=i%2?.46:1;return `${n(cx+Math.cos(a)*27*k)} ${n(cy+Math.sin(a)*36*k)}`;});
        art+=path(`M ${points.join(' L ')} Z`,'#5D6CF9',ink,6);
        art+=path(`M ${n(cx-7)} ${n(cy-12)} L ${n(cx-11)} ${n(cy-3)}`,'none','#FFFFFF',3);break;}
      case 14:
        art+=rect(cx-26,cy-29,52,58,9,'#FFFFFF');
        art+=rect(cx-19,cy-21,38,42,4,sign>0?'#F0463F':'#438FC6',ink,3);
        art+=path(`M ${n(cx-12)} ${n(cy-12)} L ${n(cx-5)} ${n(cy-12)}`,'none','#FFFFFF',3);break;
      case 15:
        art+=path(`M ${n(cx-28)} ${n(cy-23)} H ${n(cx+28)} V ${n(cy+5)} H ${n(cx+20)} V ${n(cy+15)} H ${n(cx+10)} V ${n(cy+23)} H ${n(cx-10)} V ${n(cy+15)} H ${n(cx-20)} V ${n(cy+5)} H ${n(cx-28)} Z`,ink,ink,2);
        art+=rect(cx-18,cy-14,8,8,0,'#FFFFFF','none',0)+rect(cx-10,cy-6,8,8,0,'#FFFFFF','none',0);break;
      case 16:
        art+=rect(cx-24,cy-29,48,58,13,'#FFFFFF66');
        art+=path(`M ${n(cx-12)} ${n(cy-6)} L ${n(cx-3)} ${n(cy-20)}`,'none','#FFFFFF',4);
        // A small wrap of tape at the near hinge retains this item's identity.
        art+=rect(cx-sign*23-5,cy-7,10,14,2,'#ECE2BD',ink,2);break;
    }
    // The lens is in front of the eye, perpendicular to the viewing direction.
    // Its face projects to almost zero width; only glass/frame thickness remains.
    // The far lens is occluded. Do not paste a frontal lens outline on the cheek.
    const halfHeight=entry.sourceNumber===13?36:entry.sourceNumber===15?23:30;
    art=temple+`<g transform="translate(${cx} ${cy}) scale(.10 1) translate(${-cx} ${-cy})">${art.slice(temple.length)}</g>`;
    art+=path(`M ${cx} ${n(cy-halfHeight)} Q ${n(cx+sign*3)} ${cy} ${cx} ${n(cy+halfHeight)}`,'none',arm,entry.sourceNumber===14?6:5);
    const x=n(Math.min(back-sign*6,cx-10)-6),y=n(cy-43),w=n(Math.max(back-sign*6,cx+10)+6-x),h=86;
    const frame=entry.frames[String(angle)][0];frame.rect=[x,y,w,h];
    await writeFile(new URL(`public${frame.url}`,root),`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${art}</svg>\n`);
  }
}
await writeFile(manifestURL,JSON.stringify(manifest)+'\n');
