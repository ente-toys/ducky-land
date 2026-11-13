import {Container,Graphics} from 'pixi.js';
import {onRink} from '../../../gameplay/rink-slide.js';

export const RINK_TRAIL_CAP=48;
export function createRinkTrails(parent) {
  const root=new Container({label:'Ice skate scratches and sparkles'}),pool=[],actors=new WeakMap();
  parent.addChild(root);
  for (let i=0;i<RINK_TRAIL_CAP;i++) {
    const mark=new Container(),scratch=new Graphics(),sparkle=new Graphics();
    scratch.moveTo(-5,0).lineTo(-5,18).moveTo(5,2).lineTo(5,22).stroke({color:0xf9ffff,width:1.7,alpha:.8});
    sparkle.moveTo(-4,0).lineTo(4,0).moveTo(0,-4).lineTo(0,4).stroke({color:0xffffff,width:1.5});
    sparkle.position.set(i%2?12:-12,10);mark.addChild(scratch,sparkle);mark.visible=false;
    root.addChild(mark);pool.push({mark,sparkle,at:-Infinity});
  }
  let time=0,rink=null,shown=false;
  return {
    begin(t,shape,reduced=false,visible=true) {
      time=t;rink=shape;shown=!!shape&&!reduced&&visible;root.visible=shown;
      for (const p of pool) {
        const age=time-p.at;p.mark.visible=shown&&age>=0&&age<.8;
        if (!shown) p.at=-Infinity;
        if (p.mark.visible) {p.mark.alpha=(1-age/.8)*.75;p.sparkle.scale.set(Math.sin(Math.PI*age/.8));}
      }
    },
    track(actor,x,y,speed,onLand=true) {
      let last=actors.get(actor);
      if (!last) {last={x,y,at:time};actors.set(actor,last);return;}
      const dx=x-last.x,dy=y-last.y,d=Math.hypot(dx,dy);
      if (!shown || !onLand || !onRink(rink,x,y) || speed<25 || d>100) {last.x=x;last.y=y;last.at=time;return;}
      if (d<13 || time-last.at<.055) return;
      const p=pool.find(p=>time-p.at>=.8);
      if (p) {p.at=time;p.mark.position.set(x,y);p.mark.rotation=Math.PI-Math.atan2(dx,dy);p.mark.visible=true;p.mark.alpha=.7;}
      last.x=x;last.y=y;last.at=time;
    },
    destroy(){root.destroy({children:true});},
  };
}
