import {Assets,Container,Sprite} from 'pixi.js';
import {RULES} from './rules.js';

const SCALE=.22;
const PARTS={body:[215,140,530,575],wisp:[395,650,150,135],puddle:[175,760,650,230],popper:[535,730,265,180],halo:[375,28,235,130],tail:[610,455,210,210]};
let loading;
export function loadKnockoutArt(){
  const urls=import.meta.glob('./assets/ghosts/*.svg',{query:'?url',import:'default',eager:true});
  return loading??=Promise.all(Object.entries(urls).map(async([path,url])=>[path.split('/').pop().slice(0,-4),await Assets.load(url)])).then(Object.fromEntries).catch(error=>{loading=null;throw error;});
}
const clamp=v=>Math.max(0,Math.min(1,v));
export function knockoutPhase(p,time,out={}){
  const age=p.alive?0:Math.max(0,time-(p.respawnAt-RULES.respawnDelay));
  out.down=!p.alive;out.age=age;out.body=!p.alive&&age<2.05;
  out.ghostAlpha=p.alive?0:1-clamp((age-2.05)/.45);
  out.groundAlpha=p.alive?0:1-clamp((age-2.5)/.4);
  return out;
}
export function ghostMotion(age,reducedMotion,out={}){
  const pop=clamp(age/.26),ease=1-Math.pow(1-pop,3);
  const kick=reducedMotion?0:Math.sin(pop*Math.PI*2)*(1-pop)*.08;
  out.sx=1-kick;out.sy=1+kick;
  out.rise=reducedMotion?0:53*ease-44+22*Math.max(0,age-.26);
  out.bob=reducedMotion?0:Math.sin(age*6)*2.5*ease;
  out.sway=reducedMotion?0:Math.sin(age*3.8)*4*ease;
  out.lean=reducedMotion?0:Math.sin(age*3.8)*.025*ease;
  out.halo=reducedMotion?0:-Math.sin((age-.08)*5)*.075*ease;
  out.wisp=reducedMotion?0:Math.sin((age-.08)*7)*.105*ease;
  out.tail=reducedMotion?0:-Math.sin((age-.08)*7)*.05*ease;
  out.splat=reducedMotion?1:1+.12*Math.sin(clamp(age/.22)*Math.PI);
  out.drop=reducedMotion?0:Math.sin(clamp(age/.28)*Math.PI)*-13;
  return out;
}

function place(sprite,part,px=512,py=970){const [x,y,w,h]=PARTS[part];sprite.anchor.set((px-x)/w,(py-y)/h);}
// The rising ghost (body, wisp, halo, devil tail) posed round its feet; the globe reuses it for Bog's pop-ups.
export function ghostParts(art,team){
  const ghost=new Container(),body=new Sprite(),wisp=new Sprite(),halo=new Sprite(),tail=new Sprite();
  place(body,'body');place(wisp,'wisp',452,683);wisp.position.set(-60,-287);
  place(halo,'halo',492,94);halo.position.set(-20,-876);
  place(tail,'tail',645,623);tail.position.set(133,-347);
  ghost.addChild(tail,wisp,body,halo);
  if(art&&team){body.texture=art[team+'-body'];wisp.texture=art[team+'-wisp'];halo.texture=art.halo;tail.texture=art['devil-tail'];tail.visible=team==='evil';}
  return {ghost,body,wisp,halo,tail};
}

export function createKnockout(objects,rig,{tilt=1,art}={}){
  const ground=new Container({label:'Shooter paint puddle and dropped popper'});
  const root=new Container({label:'Tagged Ducky rising ghost'});
  const {ghost,body,wisp,halo,tail}=ghostParts(),puddle=new Sprite(),popper=new Sprite();
  place(puddle,'puddle');place(popper,'popper',650,865);popper.position.set(138,-105);
  root.addChild(ghost);ground.addChild(puddle,popper);
  root.upright=ground.upright=true;root.scale.set(SCALE,SCALE/tilt);ground.scale.set(SCALE,SCALE/tilt);
  root.visible=ground.visible=false;objects.addChild(ground,root);
  const phase={},motion={};let respawnAt=null,hitX=0,hitY=0,side=1,team='karma',wasDown=false;
  return {root,ground,update(p,time,snapshot,reducedMotion){
    knockoutPhase(p,time,phase);
    if(!phase.down){root.visible=ground.visible=false;wasDown=false;return;}
    const inView=rig.root.visible;
    rig.root.visible=false;
    if(!wasDown||respawnAt!==p.respawnAt){
      wasDown=true;respawnAt=p.respawnAt;hitX=p.x;hitY=p.y;team=p.team==='evil'?'evil':'karma';
      const facing=p.facing??p.turn??0;side=Math.sin(facing)<-.01?1:-1;
      if(art){body.texture=art[team+'-body'];wisp.texture=art[team+'-wisp'];halo.texture=art.halo;
        tail.texture=art['devil-tail'];puddle.texture=art[team+'-puddle'];popper.texture=art[team+'-popper'];}
      tail.visible=team==='evil';
      const tag=snapshot?.splats?.findLast(s=>s.kind==='tag'&&s.victim===p.id&&Math.abs(s.born-(p.respawnAt-RULES.respawnDelay))<.2);
      const shooter=tag?.team??(team==='evil'?'karma':'evil');
      if(art)puddle.texture=art[(shooter==='karma'?'evil':'karma')+'-puddle'];
    }
    root.visible=inView&&phase.ghostAlpha>0;ground.visible=inView&&phase.groundAlpha>0;
    root.position.set(hitX,hitY);ground.position.set(hitX,hitY);
    root.zIndex=hitY+.1;ground.zIndex=hitY-.2;
    root.alpha=phase.ghostAlpha;ground.alpha=phase.groundAlpha;
    ghostMotion(phase.age,reducedMotion,motion);
    root.scale.x=SCALE*side;ground.scale.x=SCALE*side;
    ghost.scale.set(motion.sx,motion.sy);ghost.position.set(motion.sway/SCALE,(-motion.rise+motion.bob)/SCALE);ghost.rotation=motion.lean;
    halo.rotation=motion.halo;wisp.rotation=motion.wisp;tail.rotation=motion.tail;
    puddle.scale.set(motion.splat);popper.y=-105+motion.drop/SCALE;
    popper.rotation=reducedMotion?0:Math.sin(clamp(phase.age/.28)*Math.PI)*.12;
  },dispose(){root.removeFromParent();ground.removeFromParent();root.destroy({children:true});ground.destroy({children:true});}};
}
