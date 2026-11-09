// Directional arches can project their crown sideways in the same oblique
// camera as their source art. Physics stays on the ground-plane walkway.
export function deckX(x,y,arches=[]){
 for(const {a,b,w,shiftX=0} of arches){
  if(!shiftX)continue;const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=((x-a[0])*dx+(y-a[1])*dy)/l2;
  if(t<=0||t>=1||Math.abs(((x-a[0])*dy-(y-a[1])*dx)/Math.sqrt(l2))>w/2+12)continue;
  return x+shiftX*4*t*(1-t);
 }
 return x;
}

