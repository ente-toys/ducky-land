import {Container,Graphics,Text} from 'pixi.js';
import {PAINT,RULES} from './rules.js';
import {traceShot} from './physics.js';
import {isCombatHidden} from './hide-bushes.js';
import {BOG_TEAM_COLOURS} from './readability.js';
import {PALETTE} from '../../rendering/shared/palette.js';

export function createTeamMarker(objects,pose,{tilt=1,self=false}={}) {
  // name tag and hidden icon for everyone; only your own Ducky also gets the islands' coral player ring at its feet
  const root=new Container({label:'Bog team marker'});
  const ring=self?new Graphics({label:'Your player ring'}).ellipse(0,.55,36.7,8.6).stroke({color:PALETTE.coral,width:2.2}):null;
  root.upright=true;
  const colours=BOG_TEAM_COLOURS[pose.team];
  const tag=new Text({label:'Bog team name',text:pose.name,style:{fontFamily:'system-ui',fontSize:14,fontWeight:'700',fill:colours.ring,stroke:{color:0x23182f,width:4}}});
  const hiddenIcon=new Graphics({label:'Bog hidden eye-slash'});
  hiddenIcon.roundRect(-15,-11,30,22,7).fill(0x23182F);
  hiddenIcon.moveTo(-10,0).quadraticCurveTo(0,-11,10,0).quadraticCurveTo(0,11,-10,0).stroke({color:0xFFFFFF,width:2});
  hiddenIcon.circle(0,0,3).fill(0xFFFFFF);
  hiddenIcon.moveTo(-10,-8).lineTo(10,8).stroke({color:0x23182F,width:5,cap:'round'});
  hiddenIcon.moveTo(-10,-8).lineTo(10,8).stroke({color:0xFFFFFF,width:2.5,cap:'round'});
  hiddenIcon.y=-220;hiddenIcon.visible=false;
  tag.anchor.set(.5,1);tag.y=-174;if(ring)root.addChild(ring);root.addChild(tag,hiddenIcon);objects.addChild(root);
  return {root,update(p,rig,time){
    root.position.set(rig.root.x,rig.root.y);root.zIndex=rig.root.zIndex-.1;root.visible=rig.root.visible&&p.alive;
    const hidden=isCombatHidden(p,time);
    // A separate ground ring would remain visible through the translucent body.
    if(ring)ring.visible=!hidden;
    tag.text=p.alive&&p.shieldUntil>time?`${p.name} · Hidden ${Math.ceil(p.shieldUntil-time)}s`:hidden?`${p.name} · Hidden in bush`:p.name;
    tag.scale.y=hiddenIcon.scale.y=1/tilt;hiddenIcon.visible=hidden;
  },dispose(){root.removeFromParent();root.destroy({children:true});}};
}

export function createCombatEffects(objects,{blockers=[],muzzleFor=()=>null,tilt=1}={}) {
  const active=new Map(),pool=[],kept=new Set(),fired=new Map(),squirts=new Map();
  let lastLocalShot=0;
  const colourOf=p=>PAINT[p.team][(p.colour??(p.team==='evil'?(p.lastShotId??0)%4:0))%PAINT[p.team].length];
  function graphic(key,colour,kind) {
    kept.add(key);let node=active.get(key);
    if(!node){
      node=pool.pop()||new Graphics();node.clear();node.label=`Bog paint ${kind}`;
      if(kind==='shot'){
        // A rounded paint head pulling a tapering liquid tail, with a short white glint.
        node.moveTo(-110,0).bezierCurveTo(-70,-2,-30,-4,-12,-5)
          .bezierCurveTo(12,-13,15,12,-12,5).bezierCurveTo(-32,3,-78,2,-110,0).closePath().fill(colour);
        node.ellipse(-7,-2,8,1.8).fill({color:0xffffff,alpha:.65});
        node.ellipse(-76,5,5,2).fill({color:colour,alpha:.65});
      }else if(kind==='squirt'){
        node.moveTo(-2,0).quadraticCurveTo(8,-6,14,-4).quadraticCurveTo(26,-9,24,0)
          .quadraticCurveTo(26,10,14,5).quadraticCurveTo(8,7,-2,0).closePath().fill(colour);
        node.ellipse(15,-2,6,1.5).fill({color:0xffffff,alpha:.7});
        node.circle(29,-7,2.5).circle(34,3,2).fill(colour);
      }else if(kind==='burst'){
        node.ellipse(-13,-10,4,2.5).ellipse(15,-8,3,4).ellipse(9,13,4,2.5)
          .circle(-15,7,3).circle(1,-16,2.5).fill(colour);
      }else{
        node.moveTo(-18,-1).bezierCurveTo(-29,-13,-10,-17,-6,-10)
          .bezierCurveTo(-3,-24,10,-18,10,-9).bezierCurveTo(26,-17,31,-2,17,3)
          .bezierCurveTo(31,12,13,19,7,10).bezierCurveTo(0,25,-12,19,-10,9)
          .bezierCurveTo(-27,15,-28,3,-18,-1).closePath()
          .fill({color:colour,alpha:.86});
        node.ellipse(-5,-5,6,2).fill({color:0xffffff,alpha:.38});
      }
      active.set(key,node);objects.addChild(node);
    }
    node.rotation=0;node.upright=true;node.visible=true;node.alpha=1;node.scale.set(1,1/tilt);return node;
  }
  return {
    trigger(pose,time) {
      if(!pose?.alive||!pose.lastShotId||pose.lastShotId===lastLocalShot)return false;
      lastLocalShot=pose.lastShotId;
      return time-pose.lastShotAt<.15;
    },
    update(snapshot,time=snapshot.time,{self=null,reducedMotion=false}={}) {
      kept.clear();
      const ids=new Set();
      for(const pose of snapshot.players??[]){
        ids.add(pose.id);
        const previous=fired.get(pose.id);fired.set(pose.id,pose.lastShotId??0);
        // Entry/reconnect establishes a baseline, so an old shot cannot replay a squirt.
        if(previous!==undefined&&pose.lastShotId&&pose.lastShotId!==previous&&time-pose.lastShotAt<.15)
          squirts.set(pose.id,{born:pose.lastShotAt,colour:colourOf(pose)});
      }
      for(const id of fired.keys())if(!ids.has(id)){fired.delete(id);squirts.delete(id);}
      for(const shot of snapshot.shots){
        const elapsed=Math.min(.05,Math.max(0,time-snapshot.time)),distance=Math.min(shot.left,RULES.shotSpeed*elapsed);
        const end=traceShot(shot,{x:shot.x+shot.dx*distance,y:shot.y+shot.dy*distance},blockers).point;
        const node=graphic(`shot-${shot.id}`,colourOf(shot),'shot');
        node.position.set(end.x,end.y-34);node.zIndex=end.y+.2;
        node.rotation=Math.atan2(shot.dy*tilt,shot.dx);
        const travelled=RULES.range-shot.left+distance;
        node.scale.set(Math.min(1,Math.max(0,travelled-(shot.muzzle?0:48))/110),1/tilt);
      }
      for(const splat of snapshot.splats){
        if(splat.kind==='tag')continue;
        const age=Math.max(0,time-splat.born),colour=colourOf(splat),air=splat.kind==='hit'||splat.kind==='shield'||splat.kind==='tag';
        const y=splat.y-(air||splat.kind==='wall'?34:0);
        if(splat.kind!=='tag'){
          const node=graphic(`splat-${splat.id}`,colour,'splat');
          node.position.set(splat.x,y);node.zIndex=splat.y+(air?.4:-.2);
          const pop=reducedMotion?1:age<.07?.5+age/.07*.7:1+Math.max(0,1-(age-.07)/.14)*.2;
          node.scale.set(pop,(air?1:.55)*pop/tilt);
          node.rotation=(splat.id%7-3)*.17;
          node.alpha=Math.max(0,Math.min(1,(splat.expires-time)/1.5));
        }
        if(age<.22&&!reducedMotion){
          const burst=graphic(`burst-${splat.id}`,colour,'burst'),spread=.6+age/.22*1.7;
          burst.position.set(splat.x,y);burst.zIndex=splat.y+.6;
          burst.scale.set(spread,spread/tilt);burst.alpha=1-age/.22;
          burst.rotation=splat.id*2.4;
        }
      }
      for(const [id,squirt]of squirts){
        const age=time-squirt.born,pose=(snapshot.players??[]).find(p=>p.id===id);
        if(age>.12||!pose?.alive){squirts.delete(id);continue;}
        const muzzle=muzzleFor(id);if(!muzzle)continue;
        const node=graphic(`muzzle-${id}`,squirt.colour,'squirt');
        node.position.set(muzzle.x,muzzle.y);node.zIndex=pose.y+1;
        node.rotation=Math.atan2(Math.cos(pose.aimFacing??pose.facing)*tilt,Math.sin(pose.aimFacing??pose.facing));
        const swell=reducedMotion?1:1+Math.sin(Math.min(1,Math.max(0,age)/.12)*Math.PI)*.25;
        node.scale.set(swell,swell/tilt);node.alpha=Math.max(0,1-age/.15);
      }
      for(const [key,node] of active)if(!kept.has(key)){node.removeFromParent();node.visible=false;active.delete(key);pool.push(node);}
    },
    dispose(){for(const node of [...active.values(),...pool]){node.removeFromParent();node.destroy();}active.clear();pool.length=0;fired.clear();squirts.clear();},
  };
}
