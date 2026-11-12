import fs from 'node:fs';
import {plantOuter} from '../campfire-boss-eye/garden.mjs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {Path2D,PathOp,ring,curve,stroke,union,contours} from '../pagepond/geometry.mjs';
import {tileSvg,source} from '../campfire-ground/build.mjs';
const A='public/pixi-art/themes/community/',D='assets/world/themes/community/',S='scripts/campfire-hamlets/';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(S+'baseline/art.json'),world=read(S+'baseline/world.json'),walk=read(S+'baseline/walk-world.json'),original=read('scripts/bigger-community/baseline/world.json'),originalArt=read('scripts/bigger-community/baseline/art.json'),previous=read('scripts/bigger-community/plan.json');
const sites={storynest:{at:[-950,-530],sx:1.5,sy:1.5},patchwing:{at:[7050,300],sx:1.25,sy:1.5},sproutshare:{at:[-550,4500],sx:1.5,sy:1.5},lanternloaf:{at:[6450,4500],sx:1.25,sy:1.3}};
const props=[],shapes=[],links=[],courts=[],changes=[],skipped=[],shadows=[];
world.water=world.water.filter(w=>!(w.rx===108&&w.ry===54)&&w.id!=='community-review-water-4');
const pos=(s,p)=>[s.at[0]+p[0]*s.sx,s.at[1]+p[1]*s.sy];
const ellipse=(x,y,rx,ry)=>{const p=new Path2D();p.ellipse(x,y,rx,ry,0,0,Math.PI*2);return p;};
const contactPoly=p=>{const b=p.getBounds(),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,rx=(b[2]-b[0])/2,ry=(b[3]-b[1])/2;return Array.from({length:24},(_,i)=>[+(cx+rx*Math.cos(i*Math.PI/12)).toFixed(3),+(cy+ry*Math.sin(i*Math.PI/12)).toFixed(3)]);};
const bounds=p=>p.getBounds(),hasArea=p=>{const b=bounds(p);return b&&b[2]-b[0]>.12&&b[3]-b[1]>.12;};
const intersects=(a,b)=>{const x=bounds(a),y=bounds(b);return x[0]<y[2]&&x[2]>y[0]&&x[1]<y[3]&&x[3]>y[1]&&hasArea(new Path2D(a).op(b,PathOp.Intersect));};
const wet=union(world.water.map(o=>o.poly?new Path2D(ring(o.poly)):ellipse(o.x,o.y,o.rx,o.ry)));
const dry=new Path2D(ring(world.coast)).op(wet,PathOp.Difference),locked=new Path2D(ring(original.coast));
art.props=structuredClone(originalArt.props).filter(p=>!p.src.includes('badge-buoy'));world.obstacles=structuredClone(original.obstacles);walk.obstacles=structuredClone(original.obstacles);
const parentOf=(h,id)=>{
 if(h==='storynest'&&/^treehouse-/.test(id))return 'reading-treehouse';
 if(h==='patchwing'&&/^(sewing-machine|fabric-display-table|fabric-shelf-|hall-)/.test(id))return 'quilting-hall';
 if(h==='sproutshare'&&/^seedling-table-/.test(id))return 'greenhouse';
 if(h==='lanternloaf'&&/^(bakery-workbench|bakery-paper-rolls|bakery-table-lantern)/.test(id))return 'bakery';
 if(h==='lanternloaf'&&id==='flower-box-cottage')return 'cottage-southwest';
 return null;
};
for(const [h,s]of Object.entries(sites)){
 const layout=read(S+'layouts/'+h+'.json'),objects=layout.objects??layout.pieces;
 const normalized=objects.map(o=>({...o,x:o.bottomCentre?.[0]??o.x,y:o.bottomCentre?.[1]??o.y}));
 const houses=normalized.filter(o=>/cottage/.test(o.id));s.k=380/Math.max(...houses.map(o=>o.width));
 s.houseHeight=Math.max(...houses.map(o=>o.height*s.k));
 fs.mkdirSync(A+'hamlets/'+h,{recursive:true});
 for(const o of normalized){
  const output=A+'hamlets/'+h+'/'+o.file;
  let svg=fs.readFileSync(fs.existsSync(output)?output:'../concepts/themes/work/campfire-check/svg/'+h+'/'+o.file,'utf8');
  let first=true;if(!fs.existsSync(output))svg=svg.replace(/<ellipse\b[^>]*\/>/g,tag=>{if(!first)return tag;first=false;const attr=k=>tag.match(new RegExp('\\b'+k+'="([^"]+)"'))?.[1];return +attr('stroke-width')===0&&+attr('cy')>o.height*.6&&+attr('ry')<o.height*.16? '':tag;});
  if(!fs.existsSync(output))fs.writeFileSync(output,svg);
  const parent=parentOf(h,o.id),base=normalized.find(p=>p.id===(parent??o.id));let k=s.k;
  if(base.kind==='building'&&!/cottage/.test(base.id))k=Math.min(k,380*(h==='lanternloaf'||h==='patchwing'?1.5:1.15)/base.width,s.houseHeight*1.15/base.height);
  let [x,y]=pos(s,[o.x,o.y]);if(parent){const p=pos(s,[base.x,base.y]);x=p[0]+(o.x-base.x)*k;y=p[1]+(o.y-base.y)*k;}
  if(h==='storynest'&&o.id==='cottage-southeast'){x=950;y=820;}
  const width=o.width*k,height=o.height*k,id='hamlet-'+h+'-'+o.id;
  const p={id,name:o.id,src:'hamlets/'+h+'/'+o.file,x,y,width,height,scale:1,anchor:{x:.5,y:1},sortY:y,shadow:false,groundShadow:true,hamlet:h,kind:o.kind,blueprintId:o.id,...(parent?{parent:'hamlet-'+h+'-'+parent}:{})};
  if(parent){p.sortY=pos(s,[base.x,base.y])[1]+2+(o.drawOrder??o.y)/10000;}
  const building=o.kind==='building';const rx=width*(building?.38:/lamp|post/.test(o.id)?.19:.37),ry=building?Math.min(height*.12,44):Math.min(height*.15,width*.19);
  const shape=ellipse(x,y-(building?ry+15:ry*.5),Math.max(7,rx),Math.max(5,ry));
  const sh={id,hamlet:h,kind:o.kind,parent:p.parent,solid:!parent,shape};
  p.footprint={poly:contactPoly(shape)};props.push(p);shapes.push(sh);
 }
 for(const [i,t]of (layout.trees??layout.treeSpots).entries()){
  let src=t.asset.replace(/^public\/pixi-art\//,'').replace(/^themes\/community\//,'');
  if(src.startsWith('plants/'))src='/pixi-art/'+src;
  let [x,y]=pos(s,[t.x,t.y]);if(h==='sproutshare'&&t.id==='existing-tree-09'){x=1200;y=4780;}const treeK=t.id==='treehouse-support'?1.12:1.5;const width=t.width*treeK,height=t.height*treeK,id='hamlet-'+h+'-'+t.id;
  const p={id,name:'Campfire '+t.id,src,x,y,width,height,scale:1,anchor:{x:.5,y:1},shadow:false,groundShadow:true,hamlet:h,kind:'tree',blueprintId:t.id};
  if(t.id==='treehouse-support'){p.parent='hamlet-storynest-reading-treehouse';p.sortY=pos(s,[1013,502])[1]-1;}
  if(h==='storynest'&&x>900&&y>650){x+=220;y+=10;p.x=x;p.y=y;}
  const shape=ellipse(x,y-8,width*.085,12),sh={id,hamlet:h,kind:'tree',parent:p.parent,solid:!p.parent,shape};p.footprint={poly:contactPoly(shape)};props.push(p);shapes.push(sh);
 }
 const plaza=layout.plaza;
 const pp=plaza.polygon??plaza.poly;const floor=pp?new Path2D(ring(pp.map(p=>pos(s,p)))):new Path2D(plaza.d).transform({a:s.sx,b:0,c:0,d:s.sy,e:s.at[0],f:s.at[1]});
 courts.push({id:h+'-square',hamlet:h,shape:floor});
 const z=world.zones['bigger-'+h],c=pos(s,plaza.centre??[plaza.cx??760,plaza.cy??650]);z.x=c[0];z.y=c[1];z.spawn=[c[0],c[1]+210];
 
}
const loop=[[-500,2800],[-470,2390],[-250,1650],[700,1400],[2300,100],[4000,50],[5800,100],[7000,900],[7140,1300],[7240,1690],[7500,2200],[8160,2550],[8430,2950],[8380,3555],[8100,4140],[8520,4800],[8420,5700],[8250,6030],[7800,6200],[6500,6200],[5600,5570],[4000,6140],[2700,5600],[2100,6200],[1400,6400],[350,6250],[-150,5780],[-450,5300],[-650,4700],[-250,4100],[-470,3480],[-500,2800]];
links.push({id:'island-loop',kind:'main',width:128,points:loop});
for(const [i,line]of previous.links.entries()){
 if([4,6,8].includes(i))continue;
 links.push({id:'retained-link-'+i,kind:'link',width:128,points:i===10?line.map(p=>p[0]===9080?[9085,p[1]]:p):line});
}
links.push({id:'lanternloaf-inner',kind:'link',width:128,points:[[6332,4616],[6500,4840],[6680,5100],[7000,5200]]});
links.push({id:'sproutshare-inner',kind:'link',width:128,points:[[1938,4099],[1662,4627],[1680,4940],[1500,5150],[1100,5300],[590,5380]]});
links.push({id:'harbor-approach',kind:'jetty',width:128,points:[[4000,6140],[4000,6460],[4000,6660]]});
const shapeById=new Map(shapes.map(s=>[s.id,s])),byId=new Map(props.map(p=>[p.id,p]));
function move(sh,dx,dy){const p=byId.get(sh.id);sh.shape.transform({a:1,b:0,c:0,d:1,e:dx,f:dy});p.x+=dx;p.y+=dy;if(p.sortY!==undefined)p.sortY+=dy;p.footprint={poly:contactPoly(sh.shape)};for(const c of shapes.filter(q=>q.parent===p.id))move(c,dx,dy);}
const placed=[];
for(const sh of [...shapes.filter(s=>s.kind==='building'),...shapes.filter(s=>s.kind!=='building')]){
 if(sh.parent)continue;
 const valid=q=>!intersects(q,wet)&&!hasArea(new Path2D(q).op(dry,PathOp.Difference))&&!placed.some(o=>intersects(q,o.shape));
 if(!valid(sh.shape)){
  let found=false;for(let r=24;r<=480&&!found;r+=24)for(let n=0;n<24&&!found;n++){
   const dx=Math.cos(n*Math.PI/12)*r,dy=Math.sin(n*Math.PI/12)*r,q=new Path2D(sh.shape).transform({a:1,b:0,c:0,d:1,e:dx,f:dy});
   if(valid(q)){move(sh,dx,dy);changes.push({id:sh.id,dx,dy,reason:'separate footprint or dry bank'});found=true;}
  }
  if(!found)throw Error('No dry separate contact '+sh.id);
 }
 placed.push(sh);
}
for(const p of props.filter(p=>p.kind==='building')){
 const court=courts.find(c=>c.hamlet===p.hamlet),b=bounds(court.shape),target=[(b[0]+b[2])/2,(b[1]+b[3])/2];
 links.push({id:p.id+'-door',kind:'door',width:104,points:[[p.x,p.y+8],target],target:p.id});
}
const nearestLoop=p=>{let best=null,d=Infinity;for(let i=1;i<loop.length;i++){const a=loop[i-1],b=loop[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))),q=[a[0]+dx*t,a[1]+dy*t],dd=Math.hypot(p[0]-q[0],p[1]-q[1]);if(dd<d){d=dd;best=q;}}return best;};
const entries={
 storynest:[[185,665],[235,960],[475,1220],[700,1400]],
 patchwing:[[7800,1380],[7510,1330],[7140,1300]],
 sproutshare:[[590,5380],[580,5900],[850,6260],[1400,6400]],
 lanternloaf:[[7680,5410],[7890,5750],[7990,6030],[8250,6030]]
};
for(const [h,points]of Object.entries(entries))links.push({id:h+'-entry',kind:'join',width:128,points});
const crossings=[];art.decks=art.decks.filter(d=>!d.src.startsWith('expansion/review-bridge-'));
world.bridges=structuredClone(read(S+'baseline/world.json').bridges.slice(0,-7));
for(const d of previous.reviewDecks){
 const ns=d.axis==='y',cx=d.x+d.width/2,cy=d.y+d.height/2,w=128,uv=(u,v)=>ns?[cx+v,cy+u]:[cx+u,cy+v];let lo=Infinity,hi=-Infinity;
 for(let v=-w/2;v<=w/2;v+=8)for(let u=-700;u<=700;u+=2){if(wet.isPointInPath(...uv(u,v))){lo=Math.min(lo,u);hi=Math.max(hi,u);}}
 if(!Number.isFinite(lo))throw Error('Bridge without water '+d.name);
 lo-=35;hi+=35;const a=uv(lo,0),b=uv(hi,0),span=hi-lo,id='arched-'+crossings.length;
 let sprite;if(ns){const height=span*340/269,width=256;sprite={id,src:'/pixi-art/themes/sunflower/bridges/bridge-ns.svg',x:cx-width/2,y:cy+lo-height*50/340,width,height};}
 else{const width=span*480/420,height=256;sprite={id,src:'/pixi-art/home-expansion-c/bridges/bridge-ew.svg',x:cx+lo-width*30/480,y:cy-height*168/240,width,height};}
 art.decks.push(sprite);const crossing={id,name:d.name,a,b,w,boatPassUnder:true};crossings.push(crossing);world.walkways.push(crossing);
 world.bridges.push({id,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,w:ns?w:span+42,h:ns?span+42:w});
}
let floor=union([...courts.map(c=>c.shape),...links.map(l=>stroke(curve(l.points),l.width))]);
const contacts=union(shapes.filter(s=>s.solid).map(s=>new Path2D(s.shape).stroke({width:40}).op(s.shape,PathOp.Union)));
floor=floor.round(32).op(contacts,PathOp.Difference).op(wet,PathOp.Difference).op(dry,PathOp.Intersect).op(locked,PathOp.Difference).simplify();
const garden=plantOuter({art,world,props,shapes,floor,dry,locked,ellipse,contactPoly});
write('scripts/campfire-boss-eye/garden-report.json',garden);
for(const sh of shapes)shapeById.set(sh.id,sh);
for(const p of props){const sh=shapeById.get(p.id),b=bounds(sh.shape),rx=(b[2]-b[0])/2+7,ry=(b[3]-b[1])/2+5,x=p.x+rx*.09,y=(b[1]+b[3])/2+ry*.18;
 shadows.push(`<ellipse data-prop="${p.id}" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`);
 if(p.kind==='building')shadows.push(`<path data-base="${p.id}" d="M${b[0]} ${p.y-14}L${b[2]} ${p.y-14}l18 20H${b[0]+16}Z"/>`);
 if(sh.solid)world.obstacles.push({id:p.id,poly:p.footprint.poly});
}
const parser=new DOMParser(),doc=parser.parseFromString(source,'image/svg+xml'),root=doc.documentElement,els=n=>Array.from(n.childNodes??[]).filter(c=>c.nodeType===1),groups=els(root),g=groups[6];
for(const [i,n]of els(g).entries())if(i>=11)g.removeChild(n);
const road=doc.createElement('path');road.setAttribute('d',floor.toSVGString());road.setAttribute('fill','#fff0c7');g.appendChild(road);
const defs=doc.createElement('defs'),clip=doc.createElement('clipPath');clip.setAttribute('id','hamlet-paving');
const pavingMask=union(courts.map(c=>c.shape)).op(floor,PathOp.Intersect);const cp=doc.createElement('path');cp.setAttribute('d',pavingMask.toSVGString());clip.appendChild(cp);defs.appendChild(clip);g.appendChild(defs);
const paving=doc.createElement('g');paving.setAttribute('clip-path','url(#hamlet-paving)');paving.setAttribute('fill','none');paving.setAttribute('stroke','#dbc57f');paving.setAttribute('stroke-width','2');
for(const c of courts){const b=bounds(c.shape),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,rx=(b[2]-b[0])*.43,ry=(b[3]-b[1])*.43;
 for(const scale of [.38,.70,1]){const n=doc.createElement('ellipse');for(const [k,v]of Object.entries({cx,cy,rx:rx*scale,ry:ry*scale}))n.setAttribute(k,String(v));paving.appendChild(n);}
 for(let i=0;i<28;i++){const angle=i*Math.PI/14,lo=i%2?.38:.70,hi=i%2?.70:1;const n=doc.createElement('path');n.setAttribute('d',`M${cx+Math.cos(angle)*rx*lo} ${cy+Math.sin(angle)*ry*lo}L${cx+Math.cos(angle)*rx*hi} ${cy+Math.sin(angle)*ry*hi}`);paving.appendChild(n);}
}g.appendChild(paving);
const shadowGroup=parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><g fill="#4AA539" fill-opacity=".24">${shadows.join('')}</g></svg>`,'image/svg+xml').documentElement.firstChild;root.appendChild(doc.importNode(shadowGroup,true));
for(const n of Array.from(root.getElementsByTagName('ellipse')))if(([108,130].includes(+n.getAttribute('rx')))&&[54,72].includes(+n.getAttribute('ry')))n.parentNode.removeChild(n);
for(const n of els(root))if(n.nodeName==='path'&&/q14 -6 28 0/.test(n.getAttribute('d')))n.parentNode.removeChild(n);
for(const n of els(groups[8]).slice(0,3))n.setAttribute('d',(n.getAttribute('d').match(/M[^M]+/g)??[]).filter(d=>!d.startsWith('M5599.32 5188.97')).join(''));
for(const n of els(g))if(n.nodeName==='path'){const d=n.getAttribute('d');if(d.startsWith('M5598.12 5181.64')||d.startsWith('M 5598.12 5181.64'))n.parentNode.removeChild(n);}
const serialized=new XMLSerializer().serializeToString(doc);
for(const t of art.ground.tiles)fs.writeFileSync(A+t.src,tileSvg(t,{sourceSvg:serialized}));
const shadowSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="11200" height="8400" viewBox="-1600 -1200 11200 8400"><g fill="#4AA539" fill-opacity=".24">${shadows.join('')}</g></svg>`;
fs.writeFileSync(S+'contact-shadows.svg',shadowSvg);
art.props.push(...props);
world.paths=[...original.paths,...links.map(l=>l.points)];world.pathWidths=[...original.pathWidths,...links.map(l=>l.width)];world.props=art.props;world.boatWater=previous.reviewWater.slice(0,4).map((w,i)=>w.poly.map(([x,y])=>[x===4000&&[1,3].includes(i)?3999.99:x,y===2900?(i<2?2900.01:2899.99):y]));
world.walkways=world.walkways.map((b,i)=>i<5?{...b,boatPassUnder:true}:b);
world.communities=Object.entries(sites).map(([id])=>({...previous.communities.find(c=>c.id===id),homes:props.filter(p=>p.hamlet===id&&p.kind==='building'&&/cottage/.test(p.blueprintId)).map(p=>[p.x,p.y]),point:world.zones['bigger-'+id].spawn,lane:links.find(l=>l.id===id+'-entry').points}));
world.residentialPlots=props.filter(p=>p.kind==='building'&&/cottage/.test(p.blueprintId)).map(p=>({id:p.id,community:p.hamlet,x:p.x,y:p.y,door:[p.x,p.y+36]}));
for(const key of ['coast','water','bridges','obstacles','walkways','islets'])walk[key]=world[key];walk.zones=world.zones;walk.boatWater=world.boatWater;walk.sleepSpots=world.sleepSpots;walk.sleepTotal=world.sleepTotal;walk.props=world.props;
write(A+'art.json',art);write(D+'world.json',world);write(D+'walk-world.json',walk);
write(S+'placement.json',{sites,props:props.map(p=>p.id),shapes:shapes.map(({shape,...s})=>({...s,poly:contactPoly(shape)})),links,courts:courts.map(({shape,...c})=>({...c,d:shape.toSVGString()})),crossings,floor:floor.toSVGString(),changes,skipped,shadow:{fill:'#4AA539',opacity:.24,source:'centre/decal-paving.svg'}});
console.log(JSON.stringify({props:props.length,buildings:props.filter(p=>p.kind==='building').length,changes:changes.length,crossings:crossings.length}));
