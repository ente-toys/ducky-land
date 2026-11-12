import {hash,planPond,PondCapacityError} from './plan.mjs';

export const requestedPondCount=p=>2+((Math.imul(hash(p.island+'/'+p.id+'/count'),1664525)+1013904223)>>>31);

export function populatePond(p,assets){
 const pair=p.duckies.slice(0,2);
 if(requestedPondCount(p)===3){
  const candidates=assets.filter(d=>!pair.some(a=>a.name===d.name)&&d.width/2+10<=p.radius&&d.width*.17+8<=p.radiusY)
   .sort((a,b)=>hash(p.island+'/'+p.id+'/'+a.name)-hash(p.island+'/'+p.id+'/'+b.name));
  for(const third of candidates){
   const pond={...p,duckies:[...pair,third]};
   try{return {...pond,motion:planPond(pond)};}
   catch(error){if(!(error instanceof PondCapacityError))throw error;}
  }
 }
 const pond={...p,duckies:pair};
 return {...pond,motion:planPond(pond)};
}
