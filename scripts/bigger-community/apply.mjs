import fs from 'node:fs';
const S='scripts/bigger-community/',D='assets/world/themes/community/',A='public/pixi-art/themes/community/';
const read=p=>JSON.parse(fs.readFileSync(p));
if(!fs.existsSync('../concepts/themes/world-map/bigger/community-communities.png'))throw Error('Drawing must exist before build');
const p=read(S+'plan.json'),a=read(S+'design-art.json'),world=read(S+'baseline/world.json'),walk=read(S+'baseline/walk-world.json');
function area(pts){return Math.abs(pts.reduce((s,b,i)=>{const c=pts[(i+1)%pts.length];return s+b[0]*c[1]-c[0]*b[1]},0))/2;}
for(const w of [world,walk]){w.width=p.width;w.height=p.height;w.origin=p.origin;w.coast=p.coast;w.islets=[];w.obstacles.push(...p.obstacles);w.water.push(...(p.markerBasins??[]),...(p.reviewWater??[]));w.bridges.push(...(p.reviewBridges??[]));}
world.props=a.props;world.landArea=area(p.coast);world.expansionPlaces=p.places;
for(const s of p.places)world.zones['bigger-'+s.id]={name:s.name,x:s.x,y:s.y,rx:s.rx,ry:s.ry,spawn:s.point};
world.paths.push(p.loop,...p.links,...p.lanes);world.pathWidths.push(p.roadWidths?.main??335,...p.links.map(()=>p.roadWidths?.link??285),...p.lanes.map(()=>p.roadWidths?.lane??195));
world.rivers=p.reviewRivers;world.reviewCommons=p.reviewCommons;world.communities=p.communities;world.residentialPlots=p.homes;
const old=read(S+'baseline/world.json');const originalArea=area(old.coast);
for(const [path,data]of [[D+'world.json',world],[D+'walk-world.json',walk],[D+'harbor.json',p.harbor],[A+'art.json',a]])fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
const before=read(S+'baseline/art.json').ground.tiles.reduce((n,t)=>n+t.width*t.height*4,0),after=a.ground.tiles.reduce((n,t)=>n+t.width*t.height*4,0);
const report={originalArea,newArea:world.landArea,ratio:world.landArea/originalArea,groundBeforeMiB:before/2**20,groundAfterMiB:after/2**20,newProps:p.props.length,groundTiles:a.ground.tiles.length,sourceSVGsUntouched:true};fs.writeFileSync(S+'metrics.json',JSON.stringify(report,null,2));console.log(report);
