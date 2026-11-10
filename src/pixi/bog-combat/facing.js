// Same axes and angle convention as the island player: zero faces down,
// +PI/2 faces right. The old arena's isometric conversion is deliberately gone.
export function snapFacing(angle) {
  return Math.round(Math.atan2(Math.sin(angle),Math.cos(angle))/(Math.PI/4))*Math.PI/4;
}
export function movementFacing(vector,previous=0) {
  return vector.x||vector.y ? snapFacing(Math.atan2(vector.x,vector.y)) : previous;
}
export function facingVector(angle,out={}) {
  out.x=Math.sin(angle);out.y=Math.cos(angle);return out;
}
