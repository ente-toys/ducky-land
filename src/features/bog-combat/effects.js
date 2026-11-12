import {Container,Graphics,Text} from 'pixi.js';
import {PAINT,RULES} from './rules.js';
import {traceShot} from './physics.js';
import {isCombatHidden} from './hide-bushes.js';
import {BOG_TEAM_COLOURS} from './readability.js';

export function createTeamMarker(objects,pose,{tilt=1}={}) {
  const root=new Container({label:'Bog team marker'}),ring=new Graphics({label:'Bog saturated team ring'});
  root.upright=true;
  const colours=BOG_TEAM_COLOURS[pose.team];
  ring.circle(0,0,31).stroke({color:colours.rim,width:11});
  ring.circle(0,0,31).stroke({color:colours.ring,width:7});
  const tag=new Text({label:'Bog team name',text:pose.name,style:{fontFamily:'system-ui',fontSize:14,fontWeight:'700',fill:colours.ring,stroke:{color:0x23182f,width:4}}});
  const hiddenIcon=new Graphics({label:'Bog hidden eye-slash'});
  hiddenIcon.roundRect(-15,-11,30,22,7).fill(0x23182F);
  hiddenIcon.moveTo(-10,0).quadraticCurveTo(0,-11,10,0).quadraticCurveTo(0,11,-10,0).stroke({color:0xFFFFFF,width:2});
  hiddenIcon.circle(0,0,3).fill(0xFFFFFF);
  hiddenIcon.moveTo(-10,-8).lineTo(10,8).stroke({color:0x23182F,width:5,cap:'round'});
  hiddenIcon.moveTo(-10,-8).lineTo(10,8).stroke({color:0xFFFFFF,width:2.5,cap:'round'});
  hiddenIcon.y=-220;hiddenIcon.visible=false;
  tag.anchor.set(.5,1);tag.y=-174;root.addChild(ring,tag,hiddenIcon);objects.addChild(root);
  return {root,update(p,rig,time){
    root.position.set(rig.root.x,rig.root.y);root.zIndex=rig.root.zIndex-.1;root.visible=rig.root.visible&&p.alive;
    const hidden=isCombatHidden(p,time);
    tag.text=p.alive&&p.shieldUntil>time?`${p.name} · Hidden ${Math.ceil(p.shieldUntil-time)}s`:hidden?`${p.name} · Hidden in bush`:p.name;
    tag.scale.y=hiddenIcon.scale.y=1/tilt;ring.alpha=1;hiddenIcon.visible=hidden;
  },dispose(){root.removeFromParent();root.destroy({children:true});}};
}

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
        if(splat.kind==='tag')continue;
        const node=graphic(`splat-${splat.id}`,PAINT[splat.team][splat.colour%PAINT[splat.team].length],'splat');
        node.position.set(splat.x,splat.y-(splat.kind==='wall'?16:0));node.zIndex=splat.y-.2;
        node.alpha=Math.max(0,Math.min(.8,(splat.expires-time)/1.5));
      }
      if(self&&time<flashUntil){const muzzle=muzzleFor(self.id);if(muzzle){const node=graphic('local-muzzle',PAINT[self.team][0],'flash');node.position.set(muzzle.x,muzzle.y);node.zIndex=self.y+1;}}
      for(const [key,node] of active)if(!kept.has(key)){node.removeFromParent();node.visible=false;active.delete(key);pool.push(node);}
    },
    dispose(){for(const node of [...active.values(),...pool]){node.removeFromParent();node.destroy();}active.clear();pool.length=0;},
  };
}
