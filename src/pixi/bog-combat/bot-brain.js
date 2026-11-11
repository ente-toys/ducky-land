// Shared demo/live AI. No browser, renderer, timer or transport dependency.
import {traceShot} from './physics.js';
import {movementFacing,facingVector} from './facing.js';
import {RULES} from './rules.js';
import {BOG_AREAS} from '../bog-environment.js';
import {createBotNavigation} from './bot-navigation.js';
const LANES=['mid','site-a','site-b'];

export function createBotBrain(index=0){
  return {lane:Math.floor(index/2)%3,path:[],planAt:index*.13,pause:0,retreat:false,
    reactAt:0,seq:-1,packet:{seq:0,x:0,y:0,run:false,fire:false},point:{x:0,y:0},aim:{x:0,y:0}};
}
export function resetBotBrain(b){b.path.length=0;b.planAt=0;b.retreat=false;b.reactAt=0;if(b.routeJob)b.routeJob.active=false;}
export function createBotController(sim,combat,{random=Math.random,showcase=false,heroId='bot-0'}={}){
  const nav=combat.navigation;
  const router=!showcase&&nav.clearLine?createBotNavigation(combat):null;
  function think(p,b){
    if(!p)return;
    if(p.out&&sim.state.time>=p.respawnAt+2){
      const {id,name,team,profile,stats,medalCase}=p;
      sim.leave(id);p=sim.join({id,name,team,profile,stats,medalCase});p.bot=true;
      resetBotBrain(b);
    }
    if(!p.alive){router?.cancel(b);b.path.length=0;b.planAt=0;return;}
    const hero=showcase&&p.id===heroId;
    if(!hero&&sim.state.time<(b.reactAt??0))return;
    b.reactAt=sim.state.time+(showcase?(p.team==='privacy'?.055:.19):.20+random()*.10);
    let enemy=null,near=null,nearest=Infinity,visible=RULES.range;
    for(const e of sim.state.players.values()){
      if(!e.alive||e.team===p.team||e.shieldUntil>sim.state.time)continue;
      const distance=Math.hypot(e.x-p.x,e.y-p.y);
      if(distance<nearest){nearest=distance;near=e;}
      if(distance<visible&&!traceShot(p,e,combat.blockers).blocker){visible=distance;enemy=e;}
    }
    if(p.ammo<=2)b.retreat=true;
    if(p.ammo===RULES.ammoCapacity)b.retreat=false;
    let x=0,y=0,fire=false,run=false;
    if(enemy&&!b.retreat){
      const lead=hero?Math.hypot(enemy.x-p.x,enemy.y-p.y)/RULES.shotSpeed:0;
      const dx=enemy.x-p.x+(enemy.input?.x??0)*(enemy.pace??0)*lead,dy=enemy.y-p.y+(enemy.input?.y??0)*(enemy.pace??0)*lead,d=Math.hypot(dx,dy);
      b.point.x=dx;b.point.y=dy;const angle=movementFacing(b.point),aim=facingVector(angle,b.aim);
      const cross=dx*aim.y-dy*aim.x;
      // Step sideways into a firing lane, then turn with movement and hold Space.
      if(Math.abs(cross)>(hero?16:24)){x=Math.sign(cross)*aim.y;y=-Math.sign(cross)*aim.x;}
      else if(p.facing!==angle||d>330){x=aim.x;y=aim.y;}
      // Never shoot while stepping sideways, which turns the movement-aimed gun.
      fire=Math.abs(cross)<(hero?22:showcase&&p.team==='privacy'?30:19);
      if(fire){x=aim.x;y=aim.y;}
      if(hero&&d<190&&!fire)run=true;
      if(sim.state.time>b.pause&&random()<.008)b.pause=sim.state.time+.12+random()*.25;
      if(sim.state.time<b.pause&&!fire)x=y=0;
      b.path.length=0;
      router?.cancel(b);
    }else{
      if(sim.state.time>=b.planAt&&!router?.pending(b)&&(showcase||!b.path.length)){
        b.planAt=sim.state.time+(hero?.4:1.5)+random()*(hero?.2:1);
        let target;
        if(b.retreat){
          // Break sight behind real cover while emptying the last paint to reload.
          let hidden=null;
          for(let i=0;i<12;i++){const a=random()*Math.PI*2,r=180+random()*220,xx=p.x+Math.cos(a)*r,yy=p.y+Math.sin(a)*r;
            b.point.x=xx;b.point.y=yy;
            if(nav.walkable(xx,yy)&&enemy&&traceShot(enemy,b.point,combat.blockers).blocker&&!hidden)hidden={x:xx,y:yy};}
          target=hidden??combat.pads(p.team)[0];
        }else{
          const area=BOG_AREAS[LANES[b.lane]];
          target=hero&&near?near:near&&Math.hypot(p.x-area.x,p.y-area.y)<650?near:area;
          if(Math.hypot(p.x-target.x,p.y-target.y)<180){b.lane=(b.lane+1)%3;target=BOG_AREAS[LANES[b.lane]];}
        }
        const tx=target.x+(random()-.5)*(hero?32:140),ty=target.y+(random()-.5)*(hero?32:140);
        if(router)router.route(b,p.x,p.y,tx,ty);else b.path=nav.route(p.x,p.y,tx,ty);
      }
      while(b.path.length&&Math.hypot(b.path[0][0]-p.x,b.path[0][1]-p.y)<28)b.path.shift();
      if(b.path.length){x=b.path[0][0]-p.x;y=b.path[0][1]-p.y;run=hero||(!showcase&&b.path.length>2)||Math.hypot(x,y)>260;}
      fire=b.retreat&&p.ammo>0;
    }
    // The hero reads incoming paint and makes a short perpendicular Shift dash.
    let dodging=false;
    if(hero)for(const shot of sim.state.shots){
      if(shot.team===p.team)continue;
      const dx=p.x-shot.x,dy=p.y-shot.y,ahead=dx*shot.dx+dy*shot.dy,cross=dx*shot.dy-dy*shot.dx;
      if(ahead>0&&ahead<RULES.shotSpeed*.26&&Math.abs(cross)<65){
        const sign=cross>=0?1:-1,ex=shot.dy*sign,ey=-shot.dx*sign;
        if(nav.walkable(p.x+ex*55,p.y+ey*55)){x=ex;y=ey;run=true;fire=false;dodging=true;break;}
      }
    }
    // The actual sim moves, collides, turns, shoots, tags and respawns every bot.
    // Live routing uses the island's native path follower between reactions,
    // so a coarse waypoint cannot be overshot by a held manual direction.
    if(router)p.path=b.path;
    const packet=b.packet;packet.seq=++b.seq;packet.x=x;packet.y=y;packet.run=run;packet.fire=fire;sim.input(p.id,packet);
    if(router&&b.path.length||fire&&!b.retreat&&!dodging){packet.seq=++b.seq;packet.x=packet.y=0;packet.run=false;sim.input(p.id,packet);}
  }
  return {think,step:()=>router?.step(),prepare:b=>router?.prepare(b)};
}
