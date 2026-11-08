import {readFileSync,writeFileSync} from 'node:fs';
import {geometry,inPoly} from '../../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';

// Only resident placement is resolved here. All scenery and paths are authored in build.py.
for(const theme of ['bog','snow']) {
  const data=`rive/web/themes/${theme}/`, art=JSON.parse(readFileSync(`public/pixi-art/themes/${theme}/art.json`));
  const world=JSON.parse(readFileSync(data+'world.json')), walk=geometry(world).walkable;
  const trees=art.props.filter(p=>/tree|fir/i.test(p.name??p.id)).filter(p=>inPoly(p.x,p.y+14,world.coast));
  const spots=Object.fromEntries(['nod','hammock','rock','leaf','book','chair','wing','box'].map(p=>[p,[]]));
  for(const tree of trees) {
    if(spots.nod.length>=4)break;
    const trial={...spots,nod:[...spots.nod,[tree.id,0,false]]};
    if(!resolveSleepSpots(world,art.props,walk,sleepHalfWidths(),{spots:trial,warn:false}).bad.length)spots.nod.push([tree.id,0,false]);
  }
  const poses=['hammock','rock','leaf','book','chair','wing','box'];
  // Quiet perimeter lawns, clear of the ring, rink, all three centres and harbour.
  const points=[];
  for(let y=1100;y<=4950;y+=350)for(let x=1000;x<=7100;x+=370)points.push([x,y]);
  let cursor=0;
  while(Object.values(spots).flat().length<40) {
    let added=false;
    for(let n=0;n<poses.length;n++) {
      const pose=poses[(cursor+n)%poses.length];
      for(const [x,y] of points) {
        if(theme==='bog'&&Math.abs(x-4000)<1750&&y>2150&&y<4100)continue;
        if(theme==='snow'&&((x-4000)/1350)**2+((y-2750)/900)**2<1)continue;
        const trial={...spots,[pose]:[...spots[pose],[x,y,(cursor%2)===0]]};
        if(!resolveSleepSpots(world,art.props,walk,sleepHalfWidths(),{spots:trial,warn:false}).bad.length) {
          spots[pose].push([x,y,(cursor%2)===0]);added=true;break;
        }
      }
      if(added)break;
    }
    if(!added)throw Error(`${theme}: could not place 40 residents, got ${Object.values(spots).flat().length}`);
    cursor++;
  }
  world.sleepSpots=spots;
  for(const file of ['world.json','walk-world.json'])writeFileSync(data+file,JSON.stringify(world)+'\n');
  console.log(theme,Object.fromEntries(Object.entries(spots).map(([k,v])=>[k,v.length])));
}
