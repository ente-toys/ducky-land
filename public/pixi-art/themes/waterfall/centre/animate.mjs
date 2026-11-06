// Sprite animation for centre.json pieces. SVG/SMIL alone does not animate Pixi textures.
// records = [{piece, sprite}], with sprites at their final placement and SVG natural size. Any sprite anchor is supported.
// Call once per ticker with elapsed seconds. No allocations, filters, or texture uploads per frame.
export function animateCentre(records, seconds, reducedMotion = false) {
  for (const {piece:p, sprite:s} of records) {
    const a = p.animate;
    if (!a) continue;
    if (!s.centreRest) s.centreRest = {x:s.x,y:s.y,sx:s.scale.x,sy:s.scale.y};
    const b=s.centreRest;
    s.x=b.x; s.y=b.y; s.scale.set(b.sx,b.sy); s.alpha=1;
    if(reducedMotion) continue;
    const u=((seconds/a.period+(a.phase||0))%1+1)%1;
    if(a.kind==='flow') {
      s.y=b.y+u*a.travel*b.sy;
      s.alpha=Math.min(1,u*7,(1-u)*7)*.82;
    } else if(a.kind==='ripple') {
      const scale=.82+.32*u;
      s.scale.set(b.sx*scale,b.sy*scale);
      const pivot=a.pivot || [p.x+p.width/2,p.y+p.height/2];
      s.x=b.x+(pivot[0]-p.x-(s.anchor?.x||0)*p.width)*b.sx*(1-scale);
      s.y=b.y+(pivot[1]-p.y-(s.anchor?.y||0)*p.height)*b.sy*(1-scale);
      s.alpha=Math.sin(Math.PI*u)*.8;
    } else if(a.kind==='foam') {
      s.y=b.y+Math.sin(u*Math.PI*2)*2*b.sy;
      s.alpha=.92+.08*Math.cos(u*Math.PI*2);
    }
  }
}
