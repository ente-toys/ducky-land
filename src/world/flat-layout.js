// Gameplay chart only. Globe anchors and spherical projections stay independent.
// Mean Home-to-island centre distance on 1a26cd6e5, in world units.
export const FLAT_RADIUS=19475.34714565078;
export const FLAT_RING=['isle-55','blossom','isle-251','isle-249','sunset','isle-250'];
export const FLAT_POSITIONS=Object.fromEntries([
 ['home',{x:0,y:0}],
 ...FLAT_RING.map((id,k)=>[id,{x:FLAT_RADIUS*Math.sin(k*Math.PI/3),y:-FLAT_RADIUS*Math.cos(k*Math.PI/3)}]),
]);
export function flatOffset(from,to){
 const a=FLAT_POSITIONS[from],b=FLAT_POSITIONS[to];
 return {x:b.x-a.x,y:b.y-a.y};
}
// Outboard of each home coast, clear of the radial and ring sailing lanes.
// Pagepond's two islets sit on opposite sides of its outward bearing.
export const FLAT_ISLETS={
 'sea-1-1':{home:'isle-249',x:0,y:9500},
 'sea-2-1':{home:'home',x:-9500,y:0},
 'sea-3-1':{home:'isle-55',x:0,y:-10000},
 'sea-6-1':{home:'isle-251',x:10000,y:1000},
 'sea-7-1':{home:'sunset',x:-9000,y:5500},
 'sea-11-1':{home:'isle-251',x:4500,y:9500},
};
