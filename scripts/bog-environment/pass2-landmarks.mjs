import fs from 'node:fs';
import {views} from './arcade-modules.mjs';
const root='public/pixi-art/themes/bog-arena';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(`${root}/art.json`),layout=read('scripts/bog-environment/layout.json');
const map=read('src/pixi/bog-environment.json');
let blockers=read('src/pixi/bog-blockers.json');
const owner='pass2-landmarks';
art.props=art.props.filter(p=>p.author!==owner);
art.flats=art.flats.filter(p=>p.author!==owner);
blockers=blockers.filter(b=>b.author!==owner);
const svg=(name,w,h,title,body)=>fs.writeFileSync(`${root}/home/${name}.svg`,
 `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${title}</title><g stroke="#39472d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>\n`);
const rect=(id,kind,x,y,width,height,prop=id)=>({id,kind,type:'rect',x,y,width,height,prop,author:owner});
function footprints(p,feet,kind='landmark'){
 p.coverFootprints=feet;
 blockers.push(...feet.map(([x,y,w,h],i)=>rect(`${p.id}-foot-${i}`,kind,p.x-p.width/2+x,p.y-p.height+y,w,h,p.id)));
}
function prop(id,name,x,y,w,h,feet=[],more={}){
 const p={id,name,src:`home/${name}.svg`,x,y,width:w,height:h,scale:1,anchor:{x:.5,y:1},
  shadow:true,shadowSize:[w*.33,10],shadowOffset:[0,-6],wind:false,author:owner,...more};
 art.props.push(p);footprints(p,feet);return p;
}
const update=(id,values)=>Object.assign(art.props.find(p=>p.id===id),values);
const lantern=(x,y)=>`<path d="M${x} ${y}v12" fill="none"/><path d="M${x-15} ${y+23}l15-12 15 12v31l-15 6-15-6Z" fill="#ffe22b"/><path d="M${x-18} ${y+23}l18-12 18 12-18 7Z" fill="#168f98"/><path d="M${x} ${y+30}v27M${x-8} ${y+34}v12" fill="none"/>`;

svg('p2-balustrade',260,140,'Lilac waist-high court rail',`
 <path d="M12 108H248V136H12Z" fill="#b591c0"/>
 ${[36,83,130,177,224].map(x=>`<path d="M${x-9} 48h18l-3 13v37l5 12h-22l5-12V61Z" fill="#edceea"/>`).join('')}
 <path d="M8 36Q130 17 252 36V57Q130 41 8 57Z" fill="#d9b8df"/>
 <path d="M8 36l8-10Q130 10 244 26l8 10Q130 20 8 36Z" fill="#edceea"/>
 <path d="M12 110Q130 102 248 110M78 115v20m101-20v20" fill="none" stroke="#93729e"/>
 <path d="M9 41h24v93H9ZM227 41h24v93h-24Z" fill="#c9a7d0"/>
 <path d="M4 29h34v19H4ZM222 29h34v19h-34Z" fill="#edceea"/>`);
svg('p2-yard-wall',240,112,'Low lilac defensive yard wall',`
 <path d="M10 37H230V105H10Z" fill="#b591c0"/>
 <path d="M9 36l9-15h204l9 15v13H9Z" fill="#edceea"/>
 <path d="M9 36H231M76 50v54m88-54v54" fill="none" stroke="#93729e"/>
 <path d="M7 36H32V107H7ZM208 36h25v71h-25Z" fill="#c9a7d0"/>
 <path d="M3 17h33v22H3ZM204 17h33v22h-33Z" fill="#edceea"/>`);
svg('p2-yard-gate',240,260,'Open lilac arch, two solid gate feet',`
 <path d="M14 251V116Q120-51 226 116V251H194V123Q120 4 46 123V251Z" fill="#b591c0"/>
 <path d="M14 116Q120-51 226 116L212 128Q120-13 28 128Z" fill="#edceea"/>
 <path d="M29 122V251H46V123Q120 4 194 123V251H210V122Q120-15 29 122Z" fill="#d9b8df"/>
 <path d="M9 237H49V257H9ZM191 237h40v20h-40Z" fill="#c9a7d0"/>
 ${lantern(120,83)}`);
svg('p2-porch',640,200,'Teal covered porch with four independent posts',`
 <path d="M29 17H611L630 69H10Z" fill="#168f98"/>
 <path d="M10 69H630V84H10Z" fill="#087c83"/>
 ${[90,172,254,336,418,500,582].map(x=>`<path d="M${x} 69l-12-52" fill="none"/>`).join('')}
 <path d="M24 85L59 115M616 85l-35 30" fill="none" stroke-width="8"/>
 ${[42,190,450,598].map(x=>`<path d="M${x-9} 84h18v101h-18Z" fill="#087c83"/><path d="M${x-15} 178h30v16h-30Z" fill="#168f98"/>`).join('')}
 <path d="M232 184H408L419 194H221Z" fill="#edceea"/>
 ${lantern(320,79)}`);

const bases=[['privacy-nw',1900,1850],['google-ne',6500,1850],['privacy-sw',1900,5650],['google-se',6500,5650]];
for(const [id,x,y] of bases){
 const hall=update(`${id}-hall`,{width:640,shadowSize:[205,25]});
 const b=blockers.find(b=>b.id===hall.id);
 Object.assign(b,{x:hall.x-230.4,width:460.8});
 prop(`${id}-porch`,'p2-porch',hall.x,hall.y+125,640,200,
  [42,190,450,598].map(px=>[px-15,178,30,16]),{shadowSize:[215,12]});
 prop(`${id}-yard-gate`,'p2-yard-gate',x,y+430,240,260,[[9,237,40,20],[191,237,40,20]],{shadowSize:[80,8]});
 prop(`${id}-yard-return-west`,'p2-yard-wall',x-360,y+430,240,112,[[7,78,226,29]]);
 prop(`${id}-yard-return-east`,'p2-yard-wall',x+360,y+430,240,112,[[7,78,226,29]]);
 update(`label-${id}`,{x:x-180,y:y+150});
}

for(const [id,x,y] of [['rear-west',1885,3330],['rear-east',2225,3330],['west-return',1430,3650],['east-return',2680,3650]])
 prop(`site-a-rail-${id}`,'p2-balustrade',x,y,260,140,[[9,108,242,28]]);
svg('p2-site-a-pond',550,205,'Teal lily pond on Site A rear bank',`
 <path d="M14 111Q0 46 116 28Q243-8 395 20Q536 27 538 100Q560 164 438 180Q210 212 83 179Q8 165 14 111Z" fill="#d9b8df"/>
 <path d="M27 109Q12 56 121 41Q246 8 392 33Q522 39 524 101Q546 151 435 166Q214 197 88 166Q21 154 27 109Z" fill="#168f98"/>
 <path d="M59 110q30-12 61 0m308-19q29-12 49-2" fill="none" stroke="#9bd5c3"/>
 <path d="M102 91q-30-25 7-35q42-14 62 8l-32 13 34 1q-19 30-71 13ZM322 137q-38-24 3-40q36-10 56 6l-21 17h31q-17 31-69 17Z" fill="#b6d93b"/>`);
const pond={id:'site-a-rear-pond',src:'home/p2-site-a-pond.svg',x:2050,y:3282.5,width:550,height:205,anchor:{x:.5,y:1},author:owner};
art.flats.push(pond);
map.world.water=map.world.water.filter(w=>w.id!=='site-a-rear-pond');
const pondPoly=[[27,109],[42,76],[121,41],[246,21],[392,33],[481,56],[524,101],[523,135],[435,166],[278,184],[88,166],[38,145]]
 .map(([x,y])=>[pond.x-pond.width/2+x,pond.y-pond.height+y]);
map.world.water.push({id:pond.id,poly:pondPoly});

svg('p2-colonnade',500,280,'Mid roofed stone colonnade with three open bays',`
 <path d="M13 89L77 25H423L487 89Z" fill="#168f98"/>
 <path d="M13 89H487V104H13Z" fill="#60b3ae"/>
 ${[73,133,193,253,313,373,433].map(x=>`<path d="M${x} 89l25-64" fill="none"/>`).join('')}
 ${[[30,170],[170,330],[330,470]].map(([a,b])=>`<path d="M${a+12} 149Q${(a+b)/2} 74 ${b-12} 149V126Q${(a+b)/2} 52 ${a+12} 126Z" fill="#d9b8df"/>`).join('')}
 ${[30,170,330,470].map(x=>`<path d="M${x-11} 104h22v155h-22Z" fill="#d9b8df"/><path d="M${x+4} 107h7v150h-7Z" fill="#b591c0" stroke="none"/><path d="M${x-17} 99h34v18h-34ZM${x-19} 251h38v23h-38Z" fill="#edceea"/>`).join('')}`);
for(const id of ['mid-west','mid-east']){
 const p=update(id,{src:'home/p2-colonnade.svg',name:'moon-colonnade',width:500,height:280,shadowSize:[160,10],shadowOffset:[0,-8]});
 blockers=blockers.filter(b=>b.id!==id);
 footprints(p,[30,170,330,470].map(x=>[x-19,251,38,23]));
}

svg('p2-headstone',112,142,'Small duck-seal graveyard cover',`
 <path d="M21 116V46L56 17L91 46V116Z" fill="#d9b8df"/>
 <path d="M30 107V51L56 29L82 51V107Z" fill="#b591c0"/>
 <path d="M46 76q-12-13-2-19q10-4 14 7q18-3 18 10q-1 17-22 15q-20-1-17-13Z" fill="#edceea" stroke="#93729e" stroke-width="2"/>
 <path d="M14 116H98V127H14Z" fill="#edceea"/>
 <path d="M7 127H105V139H7Z" fill="#b591c0"/>`);
for(const [id,x,y] of [['west',6160,3750],['east',6540,3750],['front',6220,3915]])
 prop(`site-b-grave-${id}`,'p2-headstone',x,y,112,142,[[7,116,98,23]],{shadowSize:[40,8]});
const cluster=art.props.find(p=>p.id==='site-b-cottage');
blockers=blockers.filter(b=>b.id!==cluster.id);
footprints(cluster,[[41,248,87,20],[212,248,87,20],[117,280,106,20]]);
for(const [id,x,y,view] of [['upper-west',6040,3380,'left'],['upper-east',6690,3380,'right']]){
 const p=prop(`site-b-arcade-${id}`,`site-b-arcade-${view}`,x,y,190,225,[],{view,shadow:false});
 p.coverFootprints=views[view].map(([fx,fy])=>[fx-12,fy-10,24,18]);
 blockers.push(...p.coverFootprints.map(([fx,fy,w,h],i)=>rect(`${p.id}-pier-${i}`,'landmark',p.x-95+fx,p.y-225+fy,w,h,p.id)));
}

map.world.obstacles=blockers.map(b=>({id:b.id,poly:[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]]}));
const changed=new Set([...art.props.filter(p=>p.author===owner).map(p=>p.id),
 ...bases.flatMap(([id])=>[`${id}-hall`,`label-${id}`]),'mid-west','mid-east','site-b-cottage']);
layout.props=layout.props.filter(p=>p.author!==owner).map(p=>changed.has(p.id)?art.props.find(q=>q.id===p.id):p);
layout.props.push(...art.props.filter(p=>p.author===owner));
layout.flats=layout.flats.filter(p=>p.author!==owner);layout.flats.push(pond);layout.blockers=blockers;
layout.pools=layout.pools.filter(p=>p.id!=='site-a-rear-pond');
layout.pools.push({id:'site-a-rear-pond',points:map.world.water.at(-1).poly});
save(`${root}/art.json`,art);save('src/pixi/bog-blockers.json',blockers);
save('scripts/bog-environment/layout.json',layout);
fs.writeFileSync('src/pixi/bog-environment.json',JSON.stringify(map)+'\n');
console.log(`Landmarks: ${art.props.filter(p=>p.author===owner).length} added props; ${blockers.filter(b=>b.author===owner).length} matching footprints.`);
