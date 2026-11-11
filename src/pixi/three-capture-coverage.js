// A rolled viewport needs more map around it than an unrotated rectangle.
// This changes the world-space span, never the canvas pixel allocation.
export function captureCoverage(aspect,heading=0){
 if(!(Number.isFinite(aspect)&&aspect>0&&Number.isFinite(heading)))throw new RangeError('Capture coverage needs a positive aspect and finite heading');
 const c=Math.abs(Math.cos(heading)),s=Math.abs(Math.sin(heading));
 return Math.max(1.5,(c+aspect*s)*1.08,(c+s/aspect)*1.08);
}
