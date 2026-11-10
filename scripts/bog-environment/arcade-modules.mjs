import fs from 'node:fs';
// Straight lintels and vertical Home-camera piers. Three DRAWN views, no transforms.
// A round opening belongs inside each straight bay; the horseshoe is placement only.
// Home view variants change the bay width and the visible side of each pier.
// Both feet and both ends of the lintel remain level in every view.
export const views={front:[[26,190],[164,190]],left:[[26,190],[145,190]],right:[[45,190],[164,190]]};
export function writeArcadeModules(root){
for(const [view,feet] of Object.entries(views)){
 const [[ax,ay],[bx,by]]=feet,dx=bx-ax,dy=by-ay;
 const side=view==='left'?-10:4;
 const pier=(x,y)=>`<path d="M${x-10} ${y-112}h20v106h-20Z" fill="#d9b8df"/><path d="M${x+side} ${y-112}h6v106h-6Z" fill="#b591c0" stroke="none"/><path d="M${x-15} ${y-116}h30v12h-30Z" fill="#edceea"/><path d="M${x-16} ${y-7}h32v9h-32Z" fill="#b591c0"/>`;
 // The cap is straight between columns, never a bowed/warped strip.
 const cap=`<path d="M${ax-17} ${ay-142}L${bx+17} ${by-142}V${by-121}L${ax-17} ${ay-121}Z" fill="#b591c0"/><path d="M${ax-17} ${ay-142}l7 -8L${bx+24} ${by-150}l-7 8Z" fill="#edceea"/>`;
 const opening=`<path d="M${ax+10} ${ay-82}Q${ax+dx*.5} ${ay+dy*.5-158} ${bx-10} ${by-82}L${bx-10} ${by-104}Q${ax+dx*.5} ${ay+dy*.5-174} ${ax+10} ${ay-104}Z" fill="#d9b8df"/>`;
 fs.writeFileSync(`${root}/home/site-b-arcade-${view}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="190" height="225" viewBox="0 0 190 225"><title>Home-camera straight arcade bay, ${view} view</title><g data-straight-module="${view}" stroke="#39472d" stroke-width="2.2" stroke-linejoin="round">${opening}${cap}${pier(ax,ay)}${pier(bx,by)}</g></svg>\n`);
}
}
