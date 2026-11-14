import bodyMasks from './front-body-silhouettes.json' with {type:'json'};
import silhouettes from './building-silhouettes.json' with {type: 'json'};
import {propOutlineKind} from './prop-outline-rules.js';

// Opaque SVG silhouettes, normalized to the authored view box. Blocking the
// projected roof as well as the walls prevents a Ducky disappearing beneath it.
// Clearance is applied once by shared geometry, as distance to these contours.
// One raster pixel covers simplification error; it is not a second body pad.
export function buildingFootprint(prop) {
  const kind = propOutlineKind(prop);
  if (kind !== 'solid') return null;
  const contours = silhouettes[prop.src];
  if (!contours) return null;
  const outline = contours.flat();
  const w = prop.width * (prop.scale ?? 1), h = prop.height * (prop.scale ?? 1);
  if (prop.spinPeriod) {
    const radius = Math.max(...outline.map(([u,v]) => Math.hypot((u-prop.anchor.x)*w,(v-prop.anchor.y)*h)));
    // Circumscribe the full animated sweep, not only the initial blade pose.
    const r = radius / Math.cos(Math.PI/32);
    return {prop: prop.id, building: true, clearance: 22, poly: Array.from({length:32},(_,i) => [prop.x+r*Math.cos(i*Math.PI/16),prop.y+r*Math.sin(i*Math.PI/16)])};
  }
  const rings = contours.map(ring => ring.map(([u,v]) => [
    prop.x + (prop.flip ? prop.anchor.x - u : u - prop.anchor.x) * w,
    prop.y + (v - prop.anchor.y) * h,
  ]));
  return {prop: prop.id, building: true, clearance: 22 + Math.max(w,h) / 256,
    poly: rings[0], ...(rings.length > 1 ? {parts: rings.slice(1)} : {})};
}

export function solidBuilding(prop) {
  const footprint = buildingFootprint(prop);
  const outlineKind = propOutlineKind(prop);
  if (!footprint) {
    if (outlineKind === 'solid') throw Error(`Missing Home outline: ${prop.src}`);
    const {footprint: oldFootprint, ...rest} = prop;
    return {...rest, outlineKind, z: -100000, sortY: -100000};
  }
  // Sort at the front of the solid, including overhangs extending below its
  // anchor. A Ducky on the approach is in front; one above the roof is behind.
  const sortY = Math.max(...[footprint.poly, ...(footprint.parts ?? [])].flat().map(p => p[1]));
  const rings=bodyMasks[prop.id]?.map(r=>r.map(([x,y])=>[prop.x+x,prop.y+y]));
  const bodyFootprint=rings?{prop:prop.id,building:true,bodyBlock:true,clearance:0,poly:rings[0],...(rings.length>1?{parts:rings.slice(1)}:{})}:null;
  return {...prop, outlineKind, footprint, bodyFootprint, z: sortY, sortY};
}
