import fs from 'node:fs';
import {homePlant} from './plant-kit.mjs';
export const A='public/pixi-art/themes/fair/', S='scripts/bigger-fair/', D='assets/world/themes/fair/';
export const read=p=>JSON.parse(fs.readFileSync(p));
export const config=read(S+'hamlets.json');
export const layouts=Object.fromEntries(Object.keys(config).map(h=>[h,read(S+`hamlets/${h}.json`)]));
export const BUILDING=/^(house-|pavilion-|shed-|oven-|stall-|booth-|workshop-|cottage-|stage-|teacup-workshop)/;
export const HOME=/^(house-|cottage-|pavilion-(lavender|lemon))/;
export const DECAL=/^(grass-|flower-patch|flowers-|stone-|pebble)/;
export const r=v=>Math.round(v*10)/10;
export const mapper=h=>{const {at,bp,k,kp=[k,k]}=config[h].map;return ([x,y])=>[r(at[0]+(x-bp[0])*kp[0]),r(at[1]+(y-bp[1])*kp[1])];};
export function objects(h){const c=config[h],W=mapper(h);return [...layouts[h].objects].sort((a,b)=>a.drawOrder-b.drawOrder).filter(o=>!(c.skip??[]).includes(o.file)).map(o=>{
 const v=fs.readFileSync(A+`hamlets/${h}/${o.file}`,'utf8').match(/viewBox="([^"]+)"/)[1].split(/[ ,]+/).map(Number);
 const [xx,yy]=W([o.x,o.y]),n=c.nudge?.[o.id]??[0,0],x=xx+n[0],y=yy+n[1],w=r(o.width*c.map.k),height=r(w*v[3]/v[2]),building=BUILDING.test(o.file);
 const decal=DECAL.test(o.file),tree=/^tree-/.test(o.file),ry=building?Math.min(55,w*.11):tree?14:Math.min(20,w*.09),rx=building?w*.37:tree?Math.max(14,w*.09):Math.max(8,w*.3);
 return {...o,x,y,width:w,height,building,decal,fp:decal?null:{x:r(x),y:r(y-ry-8),rx:r(rx),ry:r(ry)},...homePlant({src:`hamlets/${h}/${o.file}`,width:w,height})};
 });}
export const grounds=h=>{const l=layouts[h],W=mapper(h);return [l.square,l.lane,...(l.connectingLanes??[]),...(l.secondaryLanes??[])].filter(Boolean).map(poly=>poly.map(W));};
