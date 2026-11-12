import {isHomeBuilding} from './home-buildings.js';
import sourceSizes from '../../rendering/shared/art-source-sizes.json' with {type:'json'};
const standard = rect => ({viewBox:[0,0,360,320],rect});
const BASES = {
  1: {viewBox:[-158,-240,316,261],rect:[-125,-50,125,1]},
  2: {viewBox:[-158,-240,316,261],rect:[-140,-78,130,1]},
  3: {viewBox:[0,0,316,261],rect:[31,191,285,246]},
  34: {viewBox:[-285,-430,600,475],rect:[-255,-203,255,1]},
  46: {viewBox:[0,0,270,469],rect:[27,400,243,468]},
  'house-buttercup': {viewBox:[0,0,252,314],rect:[21,230,235,311]},
  'house-honeyroof': standard([47,220,313,309]),
  bakery: standard([37,200,323,307]),
  'bread-oven': {viewBox:[0,0,119,159],rect:[7,110,114,158]},
  'house-petaldoor': standard([47,220,313,309]),
  'house-rose': {viewBox:[0,0,300,264],rect:[23,179,281,261]},
  'house-blue': standard([47,210,313,309]),
  'house-yellow': standard([47,210,313,309]),
  bandstand: {viewBox:[0,0,236,264],rect:[14,183,222,264]},
  'garden-shed': standard([47,220,313,296]),
  windmill: {viewBox:[0,0,180,272],rect:[38,210,141,270]},
  'grain-silo': {viewBox:[0,0,110,218],rect:[11,166,99,217]},
  'harvest-barn': standard([37,200,323,305]),
  'cottage-red-roof': standard([47,210,313,310]),
  'cottage-gold-roof': standard([47,210,313,310]),
  'cottage-blue-roof': standard([47,210,313,310]),
  'house-pottery-cottage': {viewBox:[0,0,420,316],rect:[11,198,405,313]},
  'house-domed-pottery-shop': standard([47,210,313,309]),
  'house-art-studio': standard([47,210,313,309]),
  kiln: {viewBox:[0,0,134,188],rect:[2,135,130,185]},
  'cottage-fishers': {viewBox:[-8,0,258,282],rect:[9,196,240,280]},
  'cottage-netmaker': standard([47,210,313,310]),
  'cottage-harbour': standard([47,210,313,310]),
  smokehouse: standard([48,229,309,309]),
  lighthouse: {viewBox:[0,0,180,310],rect:[11,244,169,310]},
};
function homeBuildingBase(p) {
  if (!isHomeBuilding(p)) return null;
  const spec=BASES[p.asset] ?? BASES[p.id];
  if (!spec) throw new Error(`Untraced Home building base: ${p.id}`);
  const {viewBox:[vx,vy,vw,vh],rect:[left,back,right,front]}=spec;
  const w=p.width*p.scale,h=p.height*p.scale;
  const [sw,sh]=sourceSizes[p.src]??[p.width,p.height],k=Math.min(sw/vw,sh/vh);
  const x=u=>p.x+(((sw-vw*k)/2+(u-vx)*k)/sw-p.anchor.x)*w;
  const y=v=>p.y+(((sh-vh*k)/2+(v-vy)*k)/sh-p.anchor.y)*h;
  return {x0:x(left),y0:y(back),x1:x(right),y1:y(front)};
}

export function fitHomeBuilding(p) {
  const b=homeBuildingBase(p);
  if (!b) return p;
  return {...p,z:Math.min(p.z??p.y,b.y1),footprint:{poly:[
    [b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1],
  ]}};
}
