import {BOG_BLOCKERS} from './bog-blockers.js';

let blockers;
export function getBogBlockers() { return blockers??=normalizeBogBlockers(BOG_BLOCKERS); }

export function normalizeBogBlockers(records) {
  return Object.freeze(records.map(record=>{
    const polygon=record.polygon??record.poly?.map(point=>Array.isArray(point)?{x:point[0],y:point[1]}:point)??(
      record.type==='rect'?[{x:record.x,y:record.y},{x:record.x+record.width,y:record.y},{x:record.x+record.width,y:record.y+record.height},{x:record.x,y:record.y+record.height}]:null);
    if(!polygon||polygon.length<3||polygon.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error(`Invalid Bog blocker: ${record.id??'unknown'}`);
    return Object.freeze({id:record.id,kind:record.kind,polygon:Object.freeze(polygon.map(p=>Object.freeze({x:p.x,y:p.y}))),blocksWalk:record.blocksWalk!==false,blocksShots:record.blocksShots!==false});
  }));
}

