import fs from 'node:fs';
import sharp from 'sharp';
const A='public/pixi-art/themes/neon/',S='scripts/bigger-neon/',O='../concepts/themes/world-map/bigger/';
const read=p=>JSON.parse(fs.readFileSync(p));
const plan=read(S+'plan.json'),base=read(S+'baseline/art.json');
const W=1764,H=1330,K=.14,ox=336,oy=322;
export async function render(art,file,{cx,cy,k=K,w=W,h=H,baseline=false,labels=false,harborOverlay=true}={}){
 const tx=cx===undefined?ox:w/2-cx*k,ty=cy===undefined?oy:h/2-cy*k,layers=[],cache=new Map();
 async function add(p,type){const sc=type==='prop'?(p.scale??1):1,ww=Math.max(1,Math.round(p.width*sc*k)),hh=Math.max(1,Math.round(p.height*sc*k));const anchor=type==='prop'?p.anchor??{x:.5,y:1}:type==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};const x=Math.round(tx+p.x*k-anchor.x*ww),y=Math.round(ty+p.y*k-anchor.y*hh);if(x>=w||y>=h||x+ww<=0||y+hh<=0)return;const source=p.src.startsWith('/')?'public'+p.src:A+p.src;const key=[source,ww,hh,p.flip].join('|');let b=cache.get(key);if(!b){let im=sharp(source,{density:72*Math.max(.3,k)}).resize(ww,hh,{fit:'fill'});if(p.flip)im=im.flop();b=await im.png().toBuffer();cache.set(key,b);}let l=Math.max(0,x),t=Math.max(0,y),cw=Math.min(ww-Math.max(0,-x),w-l),ch=Math.min(hh-Math.max(0,-y),h-t);if(cw<=0||ch<=0)return;if(cw!==ww||ch!==hh)b=await sharp(b).extract({left:Math.max(0,-x),top:Math.max(0,-y),width:cw,height:ch}).png().toBuffer();layers.push({input:b,left:l,top:t});}
 for(const p of art.ground.tiles)await add(p,'ground');
 for(const p of art.flats)await add(p,'flat');
 for(const p of art.decks)await add(p,'deck');
 const things=art.props.map(p=>({...p}));
 const oldWorld=read(S+'baseline/world.json'),poses=read('src/pixi/sleep-poses.json');
 for(const[pose,list]of Object.entries(oldWorld.sleepSpots)){for(const s of list){const tree=pose==='nod'?art.props.find(p=>p.id===s[0]):null;const[x,y,flip]=tree?[tree.x+s[1],tree.y+14,s[2]]:s;const pp=poses.poses[pose],u=pp.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=pp.box;for(const l of pp.layers){const m=await sharp('public'+l.src).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u;things.push({src:l.src,x,y:y+.01,width,height,scale:1,flip,anchor:{x:flip?1-(x0+x1)/2*u/width:(x0+x1)/2*u/width,y:y1*u/height}});}}}
 for(const p of things.sort((a,b)=>a.y-b.y))await add(p,'prop');
 // The same physical jetty as the map, rendered as a timber deck.
 const harbor=baseline?read(S+'baseline/harbor.json'):plan.harbor;
 const [hx,hy]=harbor.jetty.foot,[,tip]=harbor.jetty.tip,jw=harbor.jetty.width;
 let dock=`<path d="M${hx-jw/2} ${hy}H${hx+jw/2}V${tip}H${hx-jw/2}Z" fill="#bd9155" stroke="#80673e" stroke-width="8"/>`;
 for(let y=hy+15;y<tip;y+=30)dock+=`<path d="M${hx-jw/2} ${y}h${jw}" stroke="#e5b873" stroke-width="3"/>`;
 for(const b of harbor.boats)await add({src:'/pixi-art/boat-sail.svg',x:b.x-90,y:b.y-140,width:180,height:207,topLeft:true},'deck');
 const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g transform="translate(${tx} ${ty}) scale(${k})">${harborOverlay?dock:''}</g>${labels?plan.places.map((p,i)=>`<g transform="translate(${tx+p.x*k} ${ty+(p.y+690)*k})"><rect x="-112" y="-12" width="224" height="24" rx="12" fill="#fff3d5" stroke="#787086"/><text y="5" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#514a65">${i+1}. ${p.name}</text></g>`).join(''):''}</svg>`;
 layers.push({input:await sharp(Buffer.from(overlay)).png().toBuffer(),left:0,top:0});
 await sharp({create:{width:w,height:h,channels:4,background:'#6ec9de'}}).composite(layers).png().toFile(file);console.log(file);
}
if(process.argv.includes('--plan')){await render(base,O+'neon-now.png',{baseline:true});await render(plan.art,O+'neon-bigger.png',{labels:true});}
if(process.argv.includes('--built')){
 const art=read(A+'art.json');await render(art,O+'neon-built.png');
 const views={simmerwick:[-680,1480],ticklewick:[3300,-550],purrlumi:[8290,1630],moonwake:[4250,5480]};
 for(const p of plan.places){const[cx,cy]=views[p.id];await render(art,O+'neon-crops/'+p.id+'.png',{cx,cy,k:.8,w:1920,h:1400});}
 for(const[name,cx,cy]of [['road-junction',-510,2380],['residential-lane',3000,-390]])await render(art,O+'neon-crops/'+name+'.png',{cx,cy,k:.8,w:1440,h:1000});
 const pieces=[{input:O+'neon-communities.png',left:0,top:50},{input:O+'neon-built.png',left:W,top:50}];
 const title=Buffer.from(`<svg width="${W*2}" height="50"><rect width="100%" height="100%" fill="#fff3d5"/><g fill="#514a65" font-family="sans-serif" font-size="23"><text x="25" y="33">DRAWING / Tickytown's four communities</text><text x="${W+25}" y="33">BUILT / production SVG layers</text></g></svg>`);pieces.push({input:title,left:0,top:0});
 await sharp({create:{width:W*2,height:H+50,channels:4,background:'#6ec9de'}}).composite(pieces).png().toFile(O+'neon-vs-drawing.png');
}
