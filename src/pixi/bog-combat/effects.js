import {Container,Graphics,Text} from 'pixi.js';
import {PAINT,RULES} from './rules.js';
import {traceShot} from './physics.js';

export function createTeamMarker(objects,pose,{tilt=1}={}) {
  const root=new Container({label:'Bog team marker'}),ring=new Graphics();
  root.upright=true;
  const colours=PAINT[pose.team];
  if(colours.length===1)ring.circle(0,0,28).stroke({color:colours[0],width:3});
  else colours.forEach((color,i)=>ring.arc(0,0,28,i*Math.PI/2,(i+1)*Math.PI/2).stroke({color,width:3}));
  const tag=new Text({text:pose.name,style:{fontFamily:'system-ui',fontSize:14,fontWeight:'700',fill:colours[0],stroke:{color:0x23182f,width:4}}});
  tag.anchor.set(.5,1);tag.y=-174;root.addChild(ring,tag);objects.addChild(root);
  return {root,update(p,rig,time){
    root.position.set(rig.root.x,rig.root.y);root.zIndex=rig.root.zIndex-.1;root.visible=rig.root.visible&&p.alive;
    tag.scale.y=1/tilt;ring.alpha=p.shieldUntil>time?.5:1;
  },dispose(){root.removeFromParent();root.destroy({children:true});}};
}

// Only paint is drawn here. These pooled, bounded graphics live in the island
// scene; the island retains its renderer, terrain, props and depth ordering.
export function createCombatEffects(objects,{blockers=[],muzzleFor=()=>null,tilt=1}={}) {
  const active=new Map(),pool=[],kept=new Set();let flashUntil=0,lastFlash=-Infinity;
  function graphic(key,colour,kind) {
    kept.add(key);let node=active.get(key);
    if(!node){node=pool.pop()||new Graphics();node.clear();
      if(kind==='shot')node.circle(0,0,6).fill(colour).stroke({color:0x232323,width:1.5});
      else if(kind==='flash')node.circle(0,0,10).fill({color:colour,alpha:.8});
      else node.ellipse(0,0,16,9).fill({color:colour,alpha:.8}).circle(-11,7,3).fill(colour).circle(13,-6,4).fill(colour);
      active.set(key,node);objects.addChild(node);
    }
    node.upright=true;node.visible=true;node.alpha=1;node.scale.set(1,kind==='splat'?1:1/tilt);return node;
  }
  return {
    trigger(pose,time) {
      if(pose?.alive&&pose.ammo>0&&time-lastFlash>=RULES.fireDelay){lastFlash=time;flashUntil=time+.075;return true;}return false;
    },
    update(snapshot,time=snapshot.time,{self=null,reducedMotion=false}={}) {
      kept.clear();
      for(const shot of snapshot.shots){
        const elapsed=Math.min(.05,Math.max(0,time-snapshot.time)),distance=Math.min(shot.left,RULES.shotSpeed*elapsed);
        const end=traceShot(shot,{x:shot.x+shot.dx*distance,y:shot.y+shot.dy*distance},blockers).point;
        const node=graphic(`shot-${shot.id}`,PAINT[shot.team][shot.colour%PAINT[shot.team].length],'shot');
        node.position.set(end.x,end.y-34);node.zIndex=end.y+.2;
      }
      for(const splat of snapshot.splats){
        const node=graphic(`splat-${splat.id}`,PAINT[splat.team][splat.colour%PAINT[splat.team].length],'splat');
        node.position.set(splat.x,splat.y-(splat.kind==='wall'?16:0));node.zIndex=splat.y-.2;
        node.alpha=Math.max(0,Math.min(.8,(splat.expires-time)/1.5));
        if(splat.kind==='tag'&&!reducedMotion)node.scale.set(1+Math.max(0,.2-(time-splat.born))*2);
      }
      if(self&&time<flashUntil){const muzzle=muzzleFor(self.id);if(muzzle){const node=graphic('local-muzzle',PAINT[self.team][0],'flash');node.position.set(muzzle.x,muzzle.y);node.zIndex=self.y+1;}}
      for(const [key,node] of active)if(!kept.has(key)){node.removeFromParent();node.visible=false;active.delete(key);pool.push(node);}
    },
    dispose(){for(const node of [...active.values(),...pool]){node.removeFromParent();node.destroy();}active.clear();pool.length=0;},
  };
}
