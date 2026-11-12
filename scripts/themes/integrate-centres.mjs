// Idempotent placement of the two centres not installed by the theme builders.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8')), save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
for (const [theme,origin,k,clear] of [['waterfall',[3900,3800],.48,[-780,-650,780,640]],['canal',[4000,3320],.85,[-1060,-875,1060,810]]]) {
 const artPath=`public/pixi-art/themes/${theme}/art.json`, dir=`assets/world/themes/${theme}`, source=`scripts/themes/integrate-source/${theme}`;
 mkdirSync(source,{recursive:true});
 for(const [file,path] of [['art',artPath],['world',`${dir}/world.json`],['walk-world',`${dir}/walk-world.json`],['harbor',`${dir}/harbor.json`]]) if(!existsSync(`${source}/${file}.json`)) save(`${source}/${file}.json`,read(path));
 const art=read(`${source}/art.json`),world=read(`${source}/world.json`),walk=read(`${source}/walk-world.json`),harbor=read(`${source}/harbor.json`),c=read(`public/pixi-art/themes/${theme}/centre/centre.json`);
 const point=([x,y])=>[origin[0]+x*k,origin[1]+y*k];
 const shape=s=>{s=s.ellipse??s;return s.poly?{poly:s.poly.map(point),centre:theme}:{x:origin[0]+s.x*k,y:origin[1]+s.y*k,rx:s.rx*k,ry:s.ry*k,centre:theme};};
 const inside=(x,y)=>x>origin[0]+clear[0]&&x<origin[0]+clear[2]&&y>origin[1]+clear[1]&&y<origin[1]+clear[3];
 const nod=new Set(world.sleepSpots.nod.map(s=>s[0]));
 art.props=art.props.filter(p=>nod.has(p.id)||!inside(p.x,p.y));
 for(const map of [world,walk]) {
  map.obstacles=map.obstacles.filter(s=>{const x=s.poly?s.poly.reduce((a,p)=>a+p[0],0)/s.poly.length:s.x,y=s.poly?s.poly.reduce((a,p)=>a+p[1],0)/s.poly.length:s.y;return !inside(x,y);});
  map.obstacles.push(...c.blocked.map(shape));
  if(theme==='waterfall') map.bridges.push({x:5000,y:2440,w:170,h:860});
  map.water.push(...(c.water??[]).map(shape));
  map.arches=[...(map.arches??[]),...(c.arches??[]).map(a=>({...a,a:point(a.a),b:point(a.b),w:a.w*k,r:a.r*k}))];
  map.walkways.push(...(c.arches??[]).map(a=>({a:point(a.a),b:point(a.b),w:a.w*k})));
  if(theme==='canal') for(const w of map.walkways) if(map.arches.some(a=>a.r===64&&a.a[0]===w.a[0]&&a.a[1]===w.a[1])) w.boatPassUnder=true;
  map.centrePlacement={origin,scale:k,walkable:c.walkable.map(shape),access:(c.access??[]).map(a=>({...a,point:point(a.point),width:a.width*k}))};
 }
 for(const [i,p] of c.pieces.entries()) {
  const sort=p.sortY??p.y+p.height, base={id:`integrated-centre-${p.id}`,src:`centre/${p.file}`,width:p.width*k,height:p.height*k,scale:1,shadow:false,wind:false,centrePiece:p.id==='fountain-jets'?{...p,animate:{kind:'jet'}}:p};
  if(p.layer==='decal'||p.layer==='back') art.flats.push({...base,x:origin[0]+p.x*k,y:origin[1]+p.y*k,topLeft:true});
  else art.props.push({...base,name:`Centre ${p.id}`,x:origin[0]+(p.x+p.width/2)*k,y:origin[1]+sort*k+i*.00001,sortY:origin[1]+sort*k+i*.00001,anchor:{x:.5,y:(sort-p.y)/p.height},deck:false});
 }
 world.props=art.props;
 harbor.spawn=point(c.spawn);world.zones.plaza.spawn=harbor.spawn;world.zones.centre.spawn=harbor.spawn;world.zones.centre.placeholder=false;
 save(artPath,art);save(`${dir}/world.json`,world);save(`${dir}/walk-world.json`,walk);save(`${dir}/harbor.json`,harbor);
 console.log(theme,c.pieces.length,'centre pieces placed',origin,k);
}
