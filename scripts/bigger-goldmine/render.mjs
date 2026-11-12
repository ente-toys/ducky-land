import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
const A='public/pixi-art/themes/goldmine/',O='../concepts/themes/world-map/bigger/';
const art=JSON.parse(readFileSync(A+'art.json')),plan=JSON.parse(readFileSync('scripts/bigger-goldmine/plan.json'));
const cache=new Map();
async function render(name,crop){
 const k=crop?.k??.127,W=crop?.w??1600,H=crop?.h??1257,ox=crop?crop.x-W/2/k:plan.origin.x,oy=crop?crop.y-H/2/k:plan.origin.y;
 const layers=[];
 async function add(p,kind){
 const s=kind==='prop'?p.scale??1:1,an=kind==='prop'?p.anchor??{x:.5,y:1}:kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};
 const w=Math.max(1,Math.round(p.width*s*k)),h=Math.max(1,Math.round(p.height*s*k)),x=Math.round((p.x-ox)*k-an.x*w),y=Math.round((p.y-oy)*k-an.y*h);
 if(x>=W||y>=H||x+w<=0||y+h<=0)return;
 const src=p.src.startsWith('/')?'public'+p.src:A+p.src,key=[src,w,h,p.flip].join('|');let b=cache.get(key);
 if(!b){let im=sharp(src).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();b=await im.png().toBuffer();cache.set(key,b);}
 const left=Math.max(0,x),top=Math.max(0,y),cw=Math.min(w-Math.max(0,-x),W-left),ch=Math.min(h-Math.max(0,-y),H-top);
 if(cw<=0||ch<=0)return;
 if(cw!==w||ch!==h)b=await sharp(b).extract({left:Math.max(0,-x),top:Math.max(0,-y),width:cw,height:ch}).toBuffer();
 layers.push({input:b,left,top});
 }
 for(const tile of art.ground.tiles)await add(tile,'ground');
 for(const p of art.flats)await add(p,'flat');
 await add(art.previewHarbor,'deck');for(const p of art.decks)await add(p,'deck');
 for(const p of [...art.props].sort((a,b)=>a.y-b.y))await add(p,'prop');
 await sharp({create:{width:W,height:H,channels:4,background:art.sea}}).composite(layers).png().toFile(O+name);
}
if(process.argv.includes('--dense')){
 mkdirSync(O+'goldmine-dense-communities',{recursive:true});
 await render('goldmine-dense.png');
 for(const [id,x,y,k,w,h] of [['pickaxe',-400,2350,.5,1600,1800],['assay',3850,-300,.55,1900,1400],['panners',8900,2900,.55,1400,1800],['freight',6250,6000,.55,1600,1400]])await render(`goldmine-dense-communities/${id}.png`,{x,y,k,w,h});
 console.log('Dense overview and four community crops saved from production art.');
 process.exit(0);
}
await render('goldmine-built.png');mkdirSync(O+'goldmine-ground',{recursive:true});
for(const c of plan.communities)await render(`goldmine-ground/${c.id}.png`,{x:c.crop[0],y:c.crop[1],k:.8,w:1500,h:1200});
await render('goldmine-ground/road-junction.png',{x:-420,y:2350,k:.8,w:1400,h:1000});
await render('goldmine-ground/lane.png',{x:4900,y:-100,k:.8,w:1400,h:1000});
await render('goldmine-ground/river-crossing.png',{x:8350,y:1280,k:.8,w:1400,h:1000});
await render('goldmine-ground/old-east-jetty.png',{x:7180,y:2770,k:.8,w:1400,h:1000});
const drawing=await sharp(O+'goldmine-communities.png').resize(1200,943).toBuffer(),built=await sharp(O+'goldmine-built.png').resize(1200,943).toBuffer();
await sharp({create:{width:2400,height:943,channels:4,background:'#6EC9DE'}}).composite([{input:drawing,left:0,top:0},{input:built,left:1200,top:0}]).png().toFile(O+'goldmine-vs-drawing.png');
console.log('Production overview and eight ground crops rendered.');
if(process.argv.includes('--fixed')){
 mkdirSync(O+'goldmine-fixed-ground',{recursive:true});
 copyFileSync(O+'goldmine-built.png',O+'goldmine-fixed.png');
 for(const [src,dst] of [['river-crossing','bridge'],['road-junction','road-junction'],['assay','community'],['lane','lane'],['pickaxe','pickaxe'],['panners','panners'],['freight','freight']])copyFileSync(O+`goldmine-ground/${src}.png`,O+`goldmine-fixed-ground/${dst}.png`);
 await render('goldmine-fixed-ground/harbour.png',{x:3090,y:4855,k:.8,w:1000,h:1200});
 await render('goldmine-fixed-ground/islet-return.png',{x:5800,y:5675,k:.8,w:1100,h:1000});
 await render('goldmine-fixed-ground/orchard.png',{x:1450,y:700,k:.8,w:1500,h:1100});
 console.log('Review-fix overview, neighbourhood and crossing proofs saved.');
}
