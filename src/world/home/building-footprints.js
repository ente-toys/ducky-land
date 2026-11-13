import silhouettes from './building-silhouettes.json' with {type: 'json'};
import bases from './prop-base-silhouettes.json' with {type: 'json'};
import {propOutlineKind} from './prop-outline-rules.js';

// Opaque SVG silhouettes, normalized to the authored view box. Blocking the
// projected roof as well as the walls prevents a Ducky disappearing beneath it.
// The extra 8 units plus navigation’s 16-unit padding clear the 22-unit Duck body.
// Keep these in world data: both the renderer and worker consume this geometry.
function clearance(poly, pad = 8) {
  const area = poly.reduce((a,p,i) => {const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-q[0]*p[1];},0);
  if (area < 0) poly = poly.toReversed();
  const normal = (a,b) => {const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return [dy/len,-dx/len];};
  return poly.map((p,i) => {
    const a=normal(poly[(i+poly.length-1)%poly.length],p),b=normal(p,poly[(i+1)%poly.length]);
    const k=pad/(1+a[0]*b[0]+a[1]*b[1]);
    return [p[0]+(a[0]+b[0])*k,p[1]+(a[1]+b[1])*k];
  });
}

export function buildingFootprint(prop) {
  const kind = propOutlineKind(prop);
  if (kind !== 'solid' && kind !== 'base') return null;
  const outline = kind === 'base' ? bases[prop.src] : silhouettes[prop.src];
  if (!outline) return null;
  const w = prop.width * (prop.scale ?? 1), h = prop.height * (prop.scale ?? 1);
  if (prop.spinPeriod) {
    const radius = Math.max(...outline.map(([u,v]) => Math.hypot((u-prop.anchor.x)*w,(v-prop.anchor.y)*h)));
    // Circumscribe the full animated sweep, not only the initial blade pose.
    const r = (radius + 8) / Math.cos(Math.PI/32);
    return {prop: prop.id, building: true, poly: Array.from({length:32},(_,i) => [prop.x+r*Math.cos(i*Math.PI/16),prop.y+r*Math.sin(i*Math.PI/16)])};
  }
  return {prop: prop.id, building: true, poly: clearance(outline.map(([u, v]) => [
    prop.x + (prop.flip ? prop.anchor.x - u : u - prop.anchor.x) * w,
    prop.y + (v - prop.anchor.y) * h,
  ]))};
}

export function solidBuilding(prop) {
  const footprint = buildingFootprint(prop);
  const outlineKind = propOutlineKind(prop);
  if (!footprint) {
    if (outlineKind === 'solid' || outlineKind === 'base') throw Error(`Missing Home outline: ${prop.src}`);
    const {footprint: oldFootprint, ...rest} = prop;
    return {...rest, outlineKind, z: -100000, sortY: -100000};
  }
  // Sort at the front of the solid, including overhangs extending below its
  // anchor. A Ducky on the approach is in front; one above the roof is behind.
  const sortY = Math.max(...footprint.poly.map(p => p[1]));
  return {...prop, outlineKind, footprint, z: sortY, sortY};
}
