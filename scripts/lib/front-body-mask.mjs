import {alphaContours} from './alpha-contour.mjs';
import {HOME_DUCK_BODY} from '../../src/world/home/duck-body.js';

// Minkowski sum of alpha pixel cells with [-W/2,W/2] x [0,H].
// The feet may only be hidden while ABOVE the exact render depth. Work in
// source-pixel cells, round the radii outwards, and trace without simplification.
export function frontBodyMask(rgba, p, sortY, n=256){
  const w=p.width*(p.scale??1),h=p.height*(p.scale??1),dx=w/n,dy=h/n;
  const rx=Math.ceil(HOME_DUCK_BODY.width/2/dx),ry=Math.ceil(HOME_DUCK_BODY.height/dy);
  const size=n+rx*2, stride=n+1, sums=new Int32Array(stride*stride);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const sx=p.flip?n-1-x:x;
    sums[(y+1)*stride+x+1]=(rgba[(y*n+sx)*4+3]>32?1:0)+sums[y*stride+x+1]+sums[(y+1)*stride+x]-sums[y*stride+x];
  }
  const out=new Uint8Array(size*size*4);
  const top=p.y-p.anchor.y*h,left=(p.flip?p.anchor.x-1:-p.anchor.x)*w-rx*dx;
  const last=Math.min(n,Math.round((sortY-top)/dy));
  for(let y=0;y<last;y++)for(let x=0;x<size;x++){
    const a=Math.max(0,x-rx-rx),b=Math.min(n,x-rx+rx+1),c=Math.max(0,y-ry),d=y+1;
    if(b>a&&sums[d*stride+b]-sums[c*stride+b]-sums[d*stride+a]+sums[c*stride+a]>0)out[(y*size+x)*4+3]=255;
  }
  return alphaContours(out,size,0).map(r=>r.map(([u,v])=>[left+u*size*dx,top-p.y+v*size*dy]));
}
