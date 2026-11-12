import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {tileSvg} from './build.mjs';
const OUT=process.env.CAMPFIRE_RENDER_OUT??'../concepts/themes/work/campfire-check',A='public/pixi-art/themes/community/';
fs.mkdirSync(OUT+'/tiles',{recursive:true});fs.mkdirSync(OUT+'/seams',{recursive:true});
const old=file=>execFileSync('git',['show',`HEAD:${file}`],{maxBuffer:32*1024*1024}),art=JSON.parse(old(A+'art.json')),harbor=JSON.parse(old('assets/world/themes/community/harbor.json'));
const onlySeams=process.argv.includes('--seams-only'),prior=onlySeams?JSON.parse(fs.readFileSync(OUT+'/report.json')):null;
const tiles=art.ground.tiles,geometry=prior?.geometry??[],sizes=prior?.sizes??[];
const png=async(svg,w=700,h=700)=>sharp(svg,{limitInputPixels:false}).resize(w,h,{fit:'fill'}).png().toBuffer();
const beforeGround=new Map(),afterGround=new Map();
if(!onlySeams){
for(const t of tiles){const name=path.basename(t.src,'.svg'),original=old(A+t.src),current=fs.readFileSync(A+t.src),before=await png(original),after=await png(current);
 fs.writeFileSync(`${OUT}/tiles/${name}-before.png`,before);fs.writeFileSync(`${OUT}/tiles/${name}-after.png`,after);
 await sharp({create:{width:1400,height:700,channels:4,background:art.sea}}).composite([{input:before,left:0,top:0},{input:after,left:700,top:0}]).png().toFile(`${OUT}/tiles/${name}-comparison.png`);
 beforeGround.set(t.src,before);afterGround.set(t.src,after);
 sizes.push({src:t.src,before:original.length,after:current.length,embeddedImage:/<image\b/i.test(original.toString())});
 const reference=await sharp(original).resize(700,700).ensureAlpha().raw().toBuffer(),recovered=await sharp(Buffer.from(tileSvg(t,{style:false}))).resize(700,700).ensureAlpha().raw().toBuffer();
 let changed=0,large=0,error=0;for(let i=0;i<reference.length;i+=4){let max=0;for(let c=0;c<4;c++){const d=Math.abs(reference[i+c]-recovered[i+c]);max=Math.max(max,d);error+=d;}if(max)changed++;if(max>32)large++;}geometry.push({src:t.src,pixels:490000,changed,large,meanChannelError:error/reference.length});
 console.log(name);
}
const scale=.2,W=2240,H=1680,ox=-1600,oy=-1200,overlays=[],cache=new Map();
const source=s=>s.startsWith('/')?'public'+s:A+s;
async function add(layers,p,kind){const sc=kind==='prop'?(p.scale??1):1,w=Math.max(1,Math.round(p.width*sc*scale)),h=Math.max(1,Math.round(p.height*sc*scale)),anchor=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0},x=Math.round((p.x-ox)*scale-anchor.x*w),y=Math.round((p.y-oy)*scale-anchor.y*h);if(x>=W||y>=H||x+w<=0||y+h<=0)return;
 const key=[p.src,w,h,p.flip].join('|');let input=cache.get(key);if(!input){let im=sharp(source(p.src),{limitInputPixels:false}).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();input=await im.png().toBuffer();cache.set(key,input);}const l=Math.max(0,-x),t=Math.max(0,-y),width=Math.min(w-l,W-Math.max(0,x)),height=Math.min(h-t,H-Math.max(0,y));if(l||t||width!==w||height!==h)input=await sharp(input).extract({left:l,top:t,width,height}).png().toBuffer();layers.push({input,left:Math.max(0,x),top:Math.max(0,y)});
}
for(const f of art.flats)await add(overlays,f,'flat');
const shadow=art.props.filter(p=>p.shadow!==false&&!/bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i.test(p.name)).map(p=>{const rx=Math.max(8,Math.min(300,p.width*(p.scale??1)*.36));return `<ellipse cx="${p.x+rx*.06}" cy="${p.y+rx*.03}" rx="${rx}" ry="${rx*.3}"/>`;}).join('');
overlays.push({input:await png(Buffer.from(`<svg width="${W}" height="${H}"><g transform="translate(${-ox*scale} ${-oy*scale}) scale(${scale})" fill="#3c5a2a" opacity=".15">${shadow}</g></svg>`),W,H),left:0,top:0});
for(const d of art.decks)await add(overlays,d,'deck');const things=[...art.props];for(const b of harbor.boats)things.push({src:'/pixi-art/boat-sail.svg',x:b.x,y:b.y,width:188,height:188,anchor:{x:.5,y:.82}});
const poses=JSON.parse(fs.readFileSync('src/pixi/sleep-poses.json')),sleepers=JSON.parse(old(A+'resolved-sleepers.json'));
for(const b of sleepers){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;for(const l of p.layers){const m=await sharp(source(l.src)).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u;things.push({src:l.src,x:b.x,y:b.y,width,height,anchor:{x:b.flip?1-(x0+x1)/2*u/width:(x0+x1)/2*u/width,y:y1*u/height},flip:b.flip});}}
for(const p of things.sort((a,b)=>(a.sortY??a.y)-(b.sortY??b.y)))await add(overlays,p,'prop');
for(const version of ['before','after']){const ground=[];for(const t of tiles){const input=await sharp((version==='before'?beforeGround:afterGround).get(t.src)).resize(280,280).png().toBuffer();ground.push({input,left:Math.round((t.x-ox)*scale),top:Math.round((t.y-oy)*scale)});}const options={create:{width:W,height:H,channels:4,background:art.sea}};await sharp(options).composite(ground).png().toFile(`${OUT}/ground-${version}.png`);await sharp(options).composite([...ground,...overlays]).png().toFile(`${OUT}/island-${version}.png`);}
await sharp({create:{width:W*2,height:H,channels:4,background:art.sea}}).composite([{input:`${OUT}/island-before.png`,left:0,top:0},{input:`${OUT}/island-after.png`,left:W,top:0}]).png().toFile(`${OUT}/island-comparison.png`);
}
const seams=[],canonicalTiles=new Map();
async function canonical(t){if(!canonicalTiles.has(t.src))canonicalTiles.set(t.src,await png(Buffer.from(tileSvg(t,{cull:false})),t.width,t.height));return canonicalTiles.get(t.src);}
for(const a of tiles)for(const b of tiles){const vertical=a.y===b.y&&a.x+a.width===b.x,horizontal=a.x===b.x&&a.y+a.height===b.y;if(!vertical&&!horizontal)continue;
 const region=vertical?{x:b.x-32,y:a.y,width:64,height:a.height}:{x:a.x,y:b.y-32,width:a.width,height:64};
 const actualParts=[],expectedParts=[];for(const [t,index]of [[a,0],[b,1]]){const im=sharp(fs.readFileSync(A+t.src));const crop=vertical?{left:index?0:a.width-32,top:0,width:32,height:a.height}:{left:0,top:index?0:a.height-32,width:a.width,height:32};actualParts.push({input:await im.extract(crop).png().toBuffer(),left:vertical?index*32:0,top:horizontal?index*32:0});expectedParts.push({input:await sharp(await canonical(t)).extract(crop).png().toBuffer(),left:vertical?index*32:0,top:horizontal?index*32:0});}
 const actual=await sharp({create:{width:region.width,height:region.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(actualParts).png().toBuffer(),expected=await sharp({create:{width:region.width,height:region.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(expectedParts).png().toBuffer();
 const ar=await sharp(actual).ensureAlpha().raw().toBuffer(),er=await sharp(expected).ensureAlpha().raw().toBuffer();let changed=0,large=0,max=0,joinLarge=0,alphaGaps=0;for(let i=0;i<ar.length;i+=4){let delta=0;for(let c=0;c<4;c++)delta=Math.max(delta,Math.abs(ar[i+c]-er[i+c]));max=Math.max(max,delta);if(delta)changed++;if(delta>32){large++;const x=i/4%region.width,y=Math.floor(i/4/region.width);if(vertical?Math.abs(x-31.5)<1:Math.abs(y-31.5)<1)joinLarge++;}if(er[i+3]>250&&ar[i+3]<250)alphaGaps++;}
 const id=`${vertical?'v':'h'}-${b.x}-${b.y}`;fs.writeFileSync(`${OUT}/seams/${id}.png`,actual);seams.push({id,pixels:region.width*region.height,changed,large,max,joinLarge,alphaGaps});
}
const report={baseline:execFileSync('git',['rev-parse','HEAD']).toString().trim(),sizes,geometry,seams,unmodifiedSceneRecords:['public/pixi-art/themes/community/art.json','assets/world/themes/community/world.json','assets/world/themes/community/walk-world.json','assets/world/themes/community/harbor.json',A+'resolved-sleepers.json'].map(file=>({file,unchanged:old(file).equals(fs.readFileSync(file))}))};
fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({tiles:tiles.length,seams:seams.length,seamLargePixels:seams.reduce((s,v)=>s+v.large,0),joinLargePixels:seams.reduce((s,v)=>s+v.joinLarge,0),alphaGaps:seams.reduce((s,v)=>s+v.alphaGaps,0),geometryLargePixels:geometry.reduce((s,v)=>s+v.large,0)}));
