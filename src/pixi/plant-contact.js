import {inShape} from '../../assets/world/island-geometry.mjs';

export const PLANT_COOLDOWN = .9, PLANT_SWAY = .32, LEAF_LIFE = 1.2, LEAF_CAP = 12;
// Walking pads blockers by 16. Six more units catch the last moving step before a wall stops it.
const CONTACT_PAD = 22, RELEASE_PAD = 30, CELL = 256;
const key = (x, y) => x * 65536 + y;
const word = name => new RegExp(`(?:^|[\\s/_-])${name}(?:$|[\\s/_.-]|[0-9])`, 'i');
const TREE = word('tree'), BUSH = word('bush');
export function plantKind(prop,snow=false) {
  const label = `${prop.name ?? ''} ${prop.asset ?? ''} ${prop.src ?? ''}`;
  if (snow) {
    if (prop.finalKind==='tree' || /(?:^|[\s/_-])(?:pine|fir|spruce)(?:$|[\s/_.-]|[0-9])/i.test(label)) return 'tree';
    if (prop.finalKind==='shrub' || /(?:^|[\s/_-])shrub(?:$|[\s/_.-]|[0-9])/i.test(label)) return 'bush';
  }
  return TREE.test(label) ? 'tree' : BUSH.test(label) ? 'bush' : null;
}

function bounds(o) {
  if (!o.poly) return [o.x-o.rx, o.y-o.ry, o.x+o.rx, o.y+o.ry];
  let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
  for (const [x,y] of o.poly) {x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y);}
  return [x0,y0,x1,y1];
}

// Bind only actual tree/bush blockers, never a canopy overlap or an unrelated nearby building.
export function plantBlocker(prop, obstacles) {
  if (prop.footprint) return prop.footprint;
  let best = null, distance = Infinity;
  for (const o of obstacles) {
    if (prop.id != null && (o.prop === prop.id || o.id === prop.id)) return o;
    const b = bounds(o), x=(b[0]+b[2])/2, y=(b[1]+b[3])/2;
    const d = Math.hypot(x-prop.x, y-prop.y);
    if (Math.abs(x-prop.x) < 4 && Math.abs(y-prop.y) < 45 && d < distance) {best=o; distance=d;}
  }
  return best;
}

// One index per loaded map. Actor histories are retained once per rig, never allocated per frame.
export function createPlantContacts(props, obstacles, onBump,{snow=false}={}) {
  const plants=[], cells=new Map(), actors=new WeakMap();
  let time=0, reduced=false;
  for (const prop of props) {
    const kind=plantKind(prop,snow);
    if (!kind) continue;
    // Iceland's soft decorative shrubs deliberately have no walking blocker.
    // Give them a contact region only, keeping the authored collision map intact.
    const blocker=plantBlocker(prop,obstacles)??(snow&&kind==='bush'?{
      x:prop.x,y:prop.y-8,rx:Math.max(8,prop.width*(prop.scale??1)*.18),
      ry:Math.max(6,prop.height*(prop.scale??1)*.06),
    }:null);
    if (!blocker) continue;
    const b=bounds(blocker), plant={prop,kind,blocker,x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,
      lastAt:-Infinity,direction:1,snow};
    plants.push(plant);
    for (let c=Math.floor((b[0]-RELEASE_PAD)/CELL);c<=Math.floor((b[2]+RELEASE_PAD)/CELL);c++)
      for (let r=Math.floor((b[1]-RELEASE_PAD)/CELL);r<=Math.floor((b[3]+RELEASE_PAD)/CELL);r++) {
        const k=key(c,r); let list=cells.get(k); if (!list) cells.set(k,list=[]); list.push(plant);
      }
  }
  return {
    plants,
    begin(seconds, reduce=false) {time=seconds; reduced=reduce;},
    track(actor, x, y, onLand=true) {
      let last=actors.get(actor);
      if (!last) {last={x,y,onLand,contacts:new Set()}; actors.set(actor,last);}
      const dx=x-last.x, dy=y-last.y, distance=dx*dx+dy*dy;
      const moving=onLand && last.onLand && distance>.0001 && distance<120*120;
      last.x=x; last.y=y; last.onLand=onLand;
      if (!onLand) {last.contacts.clear(); return;}
      for (const plant of last.contacts) if (!inShape(x,y,plant.blocker,RELEASE_PAD)) last.contacts.delete(plant);
      const nearby=cells.get(key(Math.floor(x/CELL),Math.floor(y/CELL)));
      if (!nearby) return;
      for (const plant of nearby) {
        if (!inShape(x,y,plant.blocker,RELEASE_PAD)) continue;
        const entering=!last.contacts.has(plant);
        // Hysteresis prevents re-entry chatter when sliding along a curved trunk.
        if (inShape(x,y,plant.blocker,CONTACT_PAD)) {
          if (entering && moving && !reduced && plant.prop.sprite?.visible !== false &&
              dx*(plant.x-x)+dy*(plant.y-y)>0 && time-plant.lastAt>=PLANT_COOLDOWN) {
            plant.lastAt=time; plant.direction=Math.abs(dx)>.01 ? Math.sign(dx) : (x<plant.x?1:-1);
            onBump(plant,time);
          }
          last.contacts.add(plant);
        }
      }
    },
  };
}

// Select the dominant painted foliage from the source SVG, preserving each tree's palette.
// Path length weights broad canopy silhouettes over short trunk/highlight marks. Runs once per source.
export function foliageColour(svg, fallback=0x63ae45) {
  const weights=new Map();
  for (const match of svg.matchAll(/<(?:path|ellipse|circle|polygon)\b[^>]*>/gi)) {
    const tag=match[0], hex=tag.match(/\bfill=["']#([\da-f]{6}|[\da-f]{3})["']/i)?.[1];
    if (!hex) continue;
    const full=hex.length===3 ? hex.replace(/./g,c=>c+c) : hex;
    const color=parseInt(full,16), r=color>>16, g=(color>>8)&255, b=color&255;
    if (Math.max(r,g,b)<65 || Math.min(r,g,b)>205 || Math.max(r,g,b)-Math.min(r,g,b)<28) continue;
    const size=tag.match(/\bd=["']([^"']*)/)?.[1].length ?? 50;
    weights.set(color,(weights.get(color)??0)+size);
  }
  let weight=0, result=fallback;
  for (const [color,n] of weights) if (n>weight) {weight=n; result=color;}
  return result;
}
