// BUILD9. Hand-authored lane/court structures over the delivered arena.
// Run LAST after warzone/colour/teambases/pop-env. Does not rebuild terrain.
import fs from 'node:fs';
const root='public/pixi-art/themes/bog-arena/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(root+'art.json'),layout=read('scripts/bog-environment/layout.json'),map=read('src/pixi/bog-environment.json');
let blockers=read('src/pixi/bog-blockers.json');
const old=art.props.filter(p=>p.author==='warzone'&&p.coverFootprints);
const replace=new Set([...old.map(p=>p.id),...art.props.filter(p=>p.id.startsWith('lane-cover-')||/^(site-[ab]|mid)-wall-[01]$/.test(p.id)||p.wallLayout).map(p=>p.id)]);
art.props=art.props.filter(p=>!replace.has(p.id));
blockers=blockers.filter(b=>!replace.has(b.id)&&!replace.has(b.prop)&&!b.wallLayout);
// Derive an upright north/south view from the delivered wall's exact palette.
// Its foot is 58 x 244, not a rotated east/west sprite or oversized wall.
const swatch=fs.readFileSync(root+'home/wz-wall.svg','utf8');
const colours=[...swatch.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map(m=>m[1]);
const stone=colours[0],cap=colours[1],ink=swatch.match(/stroke="(#[0-9a-f]{6})"/i)[1];
const mortar=swatch.match(/stroke="(#[0-9a-f]{6})" stroke-width="1\.7"/i)?.[1]??'#aa8c69';
for(const ruin of [false,true]){
 const roof=ruin?'M8 78V30H25V8H66V252H8Z':'M8 8H66V252H8Z';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="76" height="328" viewBox="0 0 76 328"><title>${ruin?'Broken':'Straight'} north-south cream stone wall</title><g stroke="${ink}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="M8 78H66V321H8Z" fill="${stone}"/><path d="${roof}" fill="${cap}"/><path d="M8 252H66M8 278H66M8 302H66M36 252V278M49 278V302M30 302V321M8 68H66M8 129H66M8 190H66M35 8V68M46 68V129M32 129V190M47 190V252" fill="none" stroke="${mortar}" stroke-width="1.7"/>${ruin?`<path d="M24 95l14 15-7 20 12 12" fill="none" stroke="${mortar}" stroke-width="2"/>`:''}</g></svg>\n`;
 fs.writeFileSync(root+`home/wz-${ruin?'ruin':'wall'}-ns.svg`,svg);
}
const groups=[];
function piece(id,type,x,y,group,kind='cover',template){
 const vertical=type.endsWith('-ns'),w=vertical?76:260,h=vertical?328:160;
 const feet=vertical?[[8,77,58,244]]:[[8,95,244,58]];
 const [fx,fy]=feet[0];
 const p={id,name:type,src:`home/${type}.svg`,x:x-fx+w/2,y:y-fy+h,width:w,height:h,scale:1,anchor:{x:.5,y:1},shadow:true,shadowSize:vertical?[29,12]:[105,10],shadowOffset:[0,-5],wind:false,author:'warzone',wallLayout:group.id,area:group.route,coverFootprints:feet};
 if(template){p.src=template.src;p.name=template.name;p.team=template.team;}
 art.props.push(p);group.members.push(id);
 const b={id:kind==='wall'||id.startsWith('lane-cover-')?id:id+'-foot-0',prop:id,author:'warzone',wallLayout:group.id,kind,type:'rect',x,y,width:feet[0][2],height:feet[0][3]};
 blockers.push(b);return p;
}
// Each structure has a lane-aligned long arm and one connected return. Supplies
// extend a wall end; broken structures have two joined broken sides. No scatter.
function corner(id,label,route,x,y,axis,turn,material='wall',supply=null,kind='cover'){
 const g={id,label,route,axis,x,y,turn,members:[]};groups.push(g);
 const vertical=axis==='v';
 piece(id,`wz-${material}${vertical?'-ns':''}`,x,y,g,kind);
 if(vertical){const rx=turn.includes('l')?x-186:x,ry=turn.includes('t')?y:y+186;piece('wl-'+id+'-return',`wz-${material==='ruin'?'ruin':'wall'}`,rx,ry,g);}
 else {const rx=turn.includes('l')?x:x+186,ry=turn.includes('t')?y-186:y;piece('wl-'+id+'-return',`wz-${material==='ruin'?'ruin':'wall'}-ns`,rx,ry,g);}
 if(supply){const sx=vertical?(turn.includes('l')?x-430:x+244):x+244,sy=vertical?(turn.includes('t')?y:y+186):y;piece('wl-'+id+'-supplies','wz-'+supply,sx,sy,g);}
 return g;
}
// North rotation: two facing corners shelter either push into Mid.
corner('lane-cover-north-west','N1','north-loop',2920,2110,'h','lt','wall','crates');
corner('lane-cover-north-east','N2','north-loop',5236,2110,'h','rt','ruin');
// Outer lanes: long arm follows the lane; the short return catches the bend.
corner('wl-west-upper','W1','west-loop',960,2690,'h','lt','wall');
corner('lane-cover-west-pond','W2','west-loop',1370,3250,'v','rt','wall');
corner('wl-west-site','W3','west-loop',1180,3980,'v','lb','ruin');
corner('lane-cover-west-loop','W4','west-loop',1690,4800,'v','rt','wall');
// The lower west bend uses the existing base architecture, no extra block.
corner('wl-east-upper','E1','east-loop',7260,2550,'v','rb','wall');
corner('lane-cover-east-pond','E2','east-loop',7040,3365,'v','lb','wall');
corner('wl-east-site','E3','east-loop',7320,3950,'v','rb','ruin');
corner('lane-cover-east-loop','E4','east-loop',6620,4770,'v','lt','wall');
// The lower east bend uses the existing base architecture, no extra block.
// Site connectors: wall runs touch their supply ends, off the diagonal lane.
corner('lane-cover-site-a-approach','A-in','west-mid',3018,3535,'h','lt','wall');
corner('lane-cover-site-b-approach','B-in','west-mid',5090,3590,'h','rt','wall','sacks');
// Alternating spine shoulders. Returns point away from the travel lane.
corner('lane-cover-spine-north','S1','spine',3960,2820,'v','lb','wall');
corner('wl-spine-junction','S2','spine',4380,3380,'v','rb','ruin');
corner('lane-cover-spine-upper','S3','spine',4380,3860,'v','rt','wall');
corner('wl-spine-middle','S4','spine',4020,4320,'v','lb','ruin');
corner('lane-cover-spine-lower','S5','spine',3960,4720,'v','lt','wall');
corner('wl-spine-crossing','S6','spine',4380,5250,'v','rb','ruin');
corner('lane-cover-spine-south','S7','spine',4350,5730,'v','rt','wall');
corner('wl-spine-cove','S8','spine',3960,6120,'v','lt','wall');
// Southern forks and the two dry cove banks. Bridge/jetty approaches stay open.
corner('lane-cover-south-west','SW','south-west',2898,5245,'h','lt','wall','barrels');
corner('lane-cover-south-east','SE','south-west',5408,5335,'h','rt','wall');
corner('lane-cover-cove-west','C-W','west-loop',3228,6295,'h','lt','ruin','sacks');
corner('lane-cover-cove-east','C-E','east-loop',4928,6245,'h','rt','ruin');
// Court entrance jambs, connected L footprints in place of isolated plinths.
corner('site-a-wall-0','A-W','site-a-access',1518,3915,'h','lt','wall',null,'wall');
corner('site-a-wall-1','A-E','site-a-access',2458,3855,'h','rt','ruin',null,'wall');
corner('site-b-wall-0','B-W','site-b-access',5848,3915,'h','lt','ruin',null,'wall');
corner('site-b-wall-1','B-E','site-b-access',6698,3915,'h','rt','wall',null,'wall');
corner('mid-wall-0','M-W','north-loop',3520,2200,'h','lt','ruin',null,'wall');
corner('mid-wall-1','M-E','north-loop',4630,2200,'h','rt','wall',null,'wall');
// Two wider bunkers have opposing returns, 372 units of open internal floor.
// Their mouths face away from the route; the road remains the second exit.
for(const [id,extra] of [
 ['lane-cover-north-west',false],['lane-cover-south-east',true],
]){
 const g=groups.find(g=>g.id===id);g.shape='U';
 if(extra)piece('wl-'+id+'-run','wz-wall',g.x-244,g.y,g);
 piece('wl-'+id+'-second-return','wz-wall-ns',extra?g.x-244:g.x+430,g.y-186,g);
}
// Base yards and their original eight cover positions remain byte-for-byte.
// Attach low return arms to those existing plinths to make gate-flank corners.
for(const p of art.props.filter(p=>/^(privacy|google)-(nw|ne|sw|se)-wall-[01]$/.test(p.id))){
 const b=blockers.find(b=>b.id===p.id);if(!b)throw Error('Missing base cover '+p.id);
 const g={id:p.id,label:p.id,route:p.id.split('-wall-')[0],axis:'h',members:[p.id]};groups.push(g);
 const left=p.id.endsWith('-0'),x=left?b.x:b.x+b.width-58;
 // Return goes toward the back of the court, clear of respawn/gate floor.
 piece('wl-'+p.id+'-return','wz-wall-ns',x,b.y-186,g);
}
const poly=b=>[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]];
map.world.obstacles=blockers.map(b=>({id:b.id,poly:poly(b)}));
layout.blockers=blockers;layout.props=art.props.map(p=>({...p}));
layout.wallLayout={brief:'BUILD9-wall-layout.md',groups,notes:'Run wall-layout.mjs LAST after all earlier Bog overlays; all coordinates are authored, terrain/routes/bushes/yards are retained.'};
layout.warzone.coverStations=art.props.filter(p=>p.author==='warzone'&&p.coverFootprints).length;
layout.warzone.notes='Apply wall-layout.mjs LAST; BUILD9 supersedes BUILD4 cover stations.';
save(root+'art.json',art);save('scripts/bog-environment/layout.json',layout);save('src/pixi/bog-blockers.json',blockers);
fs.writeFileSync('src/pixi/bog-environment.json',JSON.stringify(map)+'\n');
console.log({groups:groups.length,pieces:groups.reduce((n,g)=>n+g.members.length,0),oldPieces:97,hideBushes:art.props.filter(p=>p.hideBush).length});
