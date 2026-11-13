// Hand-composed mirrored field cover. Re-run after editing these anchors.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const layoutPath='scripts/bog-environment/layout.json';
const artPath='public/pixi-art/themes/bog-arena/art.json';
const mapPath='src/features/bog-combat/bog-environment.json';
const blockersPath='src/features/bog-combat/bog-blockers.json';
const layout=read(layoutPath),art=read(artPath),map=read(mapPath);
const prefix='field-cover-';
const placements=[
 ['north-pond',2825,2800,2],['north-inner',3500,2700,1],
 ['north-outer',2650,1650,0],['north-back',3500,1550,0],
 ['middle-outer',1950,4450,0],['middle-court',2575,4375,0],
 ['middle-inner',3450,4350,2],['south-meadow',2200,4800,3],
 ['south-inner',3125,4875,3],['south-back',3400,5600,3],
 ['south-outer',1200,5100,2],['south-coast',2750,6500,2],
];
const templates=Object.fromEntries(['wz-wall','wz-wall-ns'].map(name=>[name,art.props.find(p=>p.name===name&&p.coverFootprints)]));
layout.props=layout.props.filter(p=>!p.id.startsWith(prefix));
layout.blockers=layout.blockers.filter(b=>!b.id.startsWith(prefix));
layout.wallLayout.groups=layout.wallLayout.groups.filter(g=>!g.id.startsWith(prefix));
for(const [area,x,y,turn] of placements)for(const side of ['west','east']){
 const id=`${prefix}${area}-${side}`,members=[];
 const feet=[{x,y,width:244,height:58},{x:x+(turn%2?186:0),y:y+(turn>=2?0:-186),width:58,height:244}];
 for(const [i,foot]of feet.entries()){
  const b={...foot};if(side==='east')b.x=8400-b.x-b.width;
  const name=i?'wz-wall-ns':'wz-wall',p=structuredClone(templates[name]);
  p.id=`${id}-${i}`;p.wallLayout=id;p.area=`field-${area}`;
  const [fx,fy]=p.coverFootprints[0];
  p.x=b.x+p.width/2-fx;p.y=b.y+p.height-fy;
  layout.props.push(p);members.push(p.id);
  layout.blockers.push({id:`${p.id}-foot-0`,prop:p.id,author:'warzone',wallLayout:id,kind:'cover',type:'rect',...b});
 }
 layout.wallLayout.groups.push({id,label:area+' '+side,area,side,shape:'L',members});
}
layout.warzone.coverStations=layout.props.filter(p=>p.author==='warzone'&&p.coverFootprints).length;
layout.wallLayout.notes='Original lane cover retained. Run field-cover.mjs after earlier overlays to add mirrored purple-field cover.';
layout.wallLayout.fieldCover={pieces:48,structures:24,mirrorX:4200,clearance:60};
art.props=[...art.props.filter(p=>!p.id.startsWith(prefix)),...layout.props.filter(p=>p.id.startsWith(prefix))];
map.world.obstacles=layout.blockers.map(b=>({id:b.id,poly:[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]]}));
write(layoutPath,layout);write(artPath,art);write(blockersPath,layout.blockers);fs.writeFileSync(mapPath,JSON.stringify(map)+'\n');
console.log('Added 48 field walls in 24 mirrored L structures.');
