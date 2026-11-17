import {walkStep} from '../../gameplay/player-motion.js';
import {facingVector,movementFacing} from './facing.js';
import {traceShot} from './physics.js';
import {RULES} from './rules.js';
import {isCombatHidden} from './hide-bushes.js';

const sight={point:{x:0,y:0},fraction:1,blocker:null};
export function assistShot(shot,player,players,blockers,time){
  const origin=Number.isFinite(shot.x)&&Number.isFinite(shot.y)?shot:player;
  let nearest=RULES.range*RULES.range,best=-1,target=null;
  const cosine=Math.cos(RULES.aimCone);
  for(const enemy of players){
    if(!enemy.alive||enemy.team===player.team||isCombatHidden(enemy,time))continue;
    const dx=enemy.x-origin.x,dy=enemy.y-origin.y,d2=dx*dx+dy*dy;
    if(d2<=0||d2>RULES.range*RULES.range)continue;
    const alignment=(dx*shot.dx+dy*shot.dy)/Math.sqrt(d2);
    if(alignment<cosine||alignment<best-1e-9||(Math.abs(alignment-best)<1e-9&&d2>=nearest))continue;
    if(traceShot(origin,enemy,blockers,sight).blocker)continue;
    nearest=d2;best=alignment;target=enemy;
  }
  if(target){
    let dx=target.x-origin.x,dy=target.y-origin.y;
    // Lead a moving target by projectile flight time, within the same small assist cone.
    const velocity=target.heading,pace=Math.min(target.travel??0,target.pace??0);
    const vx=(velocity?.[0]??0)*pace,vy=(velocity?.[1]??0)*pace;
    const a=vx*vx+vy*vy-RULES.shotSpeed**2,b=2*(dx*vx+dy*vy),c=dx*dx+dy*dy;
    const discriminant=b*b-4*a*c;
    const t=discriminant>=0&&Math.abs(a)>1e-9?(-b-Math.sqrt(discriminant))/(2*a):0;
    if(t>0&&t<=RULES.range/RULES.shotSpeed){
      const lead={x:target.x+vx*t,y:target.y+vy*t},lx=lead.x-origin.x,ly=lead.y-origin.y,len=Math.hypot(lx,ly);
      if(len<=RULES.range&&(lx*shot.dx+ly*shot.dy)/len>=cosine&&!traceShot(origin,lead,blockers,sight).blocker){dx=lx;dy=ly;}
    }
    const d=Math.hypot(dx,dy);shot.dx=dx/d;shot.dy=dy/d;
  }
  return shot;
}

export function resetAbilities(p){
  p.dodgeUntil=0;p.dodgeProtectedUntil=0;p.dodgeReadyAt=0;p.dodgeX=0;p.dodgeY=0;
  p.dodgeSerial??=0;p.dodgeQueued=0;p.hitShieldUntil=0;p.hitShield=0;
}
export function startDodge(p,serial,time,input){
  if(!(serial> (p.dodgeSerial??0)))return false;
  p.dodgeSerial=serial;
  if(!p.alive||time+1e-9<(p.dodgeReadyAt??0))return false;
  let x=input.x,y=input.y,n=Math.hypot(x,y);
  if(!n){const facing=facingVector(p.facing??0);x=facing.x;y=facing.y;n=1;}
  p.dodgeX=x/n;p.dodgeY=y/n;p.dodgeUntil=time+RULES.dodgeSeconds;
  p.dodgeProtectedUntil=time+RULES.dodgeInvulnerable;p.dodgeReadyAt=time+RULES.dodgeCooldown;
  p.until=0;p.action=1;return true;
}
function advance(p,nav,dx,dy){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/3)),sx=dx/steps,sy=dy/steps;
  for(let i=0;i<steps;i++){
    if(!nav.walkable(p.x+sx,p.y+sy))break;
    p.x+=sx;p.y+=sy;
  }
}
export function combatWalkStep(p,nav,dt,time,input){
  p.facing=Number.isFinite(input.facing)?input.facing:movementFacing(input,p.facing??0);
  if(input.dodge)startDodge(p,input.dodge,time-dt,input);
  const left=Math.max(0,Math.min(dt,(p.dodgeUntil??0)-(time-dt)));
  if(left>0){
    const x=p.x,y=p.y;p.previousX=x;p.previousY=y;
    advance(p,nav,p.dodgeX*RULES.dodgeDistance*left/RULES.dodgeSeconds,p.dodgeY*RULES.dodgeDistance*left/RULES.dodgeSeconds);
    p.pace=0;p.travel=Math.hypot(p.x-x,p.y-y)/dt;p.action=p.travel>.001?1:0;
    return;
  }
  const before=p.turn;
  walkStep(p,nav,dt,time,input,{speedMultiplier:RULES.moveSpeed});
  if(Number.isFinite(input.facing)){
    const delta=Math.atan2(Math.sin(p.facing-before),Math.cos(p.facing-before));
    p.turn=before+delta*(1-Math.exp(-18*dt));
  }
}
