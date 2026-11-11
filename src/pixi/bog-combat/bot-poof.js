// Reuse the island's bounded ink-outline dust pool. Never treat a hidden enemy
// omitted from a snapshot as a departing bot, or reveal its hidden position.
export function createBotPoofs(dust){
 let seen=0;
 return function update(snapshot,reducedMotion=false){
  for(const p of snapshot.botDepartures??[]){
   if(p.id<=seen)continue;seen=p.id;
   if(!reducedMotion&&snapshot.time-p.time<.6)dust?.land(p.x,p.y,1.3);
  }
 };
}
