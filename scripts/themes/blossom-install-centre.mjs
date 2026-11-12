// Install a replacement layered centre after its SVGs and centre.json have been supplied.
// Reads the same centre contract as Sunflower/Fair/Library; no shared code changes.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const A='public/pixi-art/themes/blossom/',D='assets/world/themes/blossom/',J=f=>JSON.parse(readFileSync(f));
const c=J(A+'centre/centre.json'),art=J(A+'art.json'),world=J(D+'world.json'),walk=J(D+'walk-world.json');
const {x:cx,y:cy,scale:s=1}=c.placement??{x:world.zones.centre.x,y:world.zones.centre.y,scale:1};
art.props=art.props.filter(p=>!p.id?.startsWith('blossom-centre-'));art.flats=art.flats.filter(p=>!p.src.startsWith('centre/'));
walk.obstacles=walk.obstacles.filter(o=>o.centre!=='blossom'&&!/^(Ancient blossom tree trunk|Hill coping west|Hill coping east)$/.test(o.name??''));
for(const p of c.pieces){
 if(!existsSync(A+'centre/'+p.file))throw Error('Missing centre/'+p.file);
 if(p.layer==='decal'){art.flats.push({src:'centre/'+p.file,x:cx+p.x*s,y:cy+p.y*s,width:p.width*s,height:p.height*s,topLeft:true});continue;}
 const sy=p.layer==='back'?-10000:(p.sortY??p.y+p.height);
 art.props.push({id:'blossom-centre-'+p.id,name:'Blossom landmark '+p.id,src:'centre/'+p.file,x:cx+p.x*s,y:cy+sy*s,width:p.width,height:p.height,scale:s,anchor:{x:0,y:(sy-p.y)/p.height},shadow:false,wind:false,zone:'centre'});
}
for(const b of c.blocked??[]){if(b.ellipse)walk.obstacles.push({name:b.name,centre:'blossom',x:cx+b.ellipse.x*s,y:cy+b.ellipse.y*s,rx:b.ellipse.rx*s,ry:b.ellipse.ry*s});else if(b.poly)walk.obstacles.push({name:b.name,centre:'blossom',poly:b.poly.map(([x,y])=>[cx+x*s,cy+y*s])});}
world.zones.centre.landmark='blossom-centre-'+(c.landmark??c.pieces.find(p=>p.layer==='sorted')?.id??c.pieces[0].id);world.zones.centre.placeholder=false;
world.props=art.props.map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,zone:p.zone}));
for(const [p,d]of [[A+'art.json',art],[D+'world.json',world],[D+'walk-world.json',walk],[D+'placements.json',art.props]])writeFileSync(p,JSON.stringify(d));
console.log('Installed',c.name,c.pieces.length,'pieces at',cx,cy);
