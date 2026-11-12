import {walkStep} from '../player-motion.js';
import {facingVector,movementFacing} from './facing.js';
import {traceShot} from './physics.js';
import {RULES} from './rules.js';
import {isCombatHidden} from './hide-bushes.js';

const sight={point:{x:0,y:0},fraction:1,blocker:null};
export function assistShot(shot,player,players,blockers,time){
  let nearest=RULES.range*RULES.range,target=null;
  const cosine=Math.cos(RULES.aimCone);
  for(const enemy of players){
    if(!enemy.alive||enemy.team===player.team||isCombatHidden(enemy,time))continue;
    const dx=enemy.x-player.x,dy=enemy.y-player.y,d2=dx*dx+dy*dy;
    if(d2<=0||d2>nearest||(dx*shot.dx+dy*shot.dy)/Math.sqrt(d2)<cosine)continue;
    if(traceShot(player,enemy,blockers,sight).blocker)continue;
    nearest=d2;target=enemy;
  }
  if(target){const d=Math.sqrt(nearest);shot.dx=(target.x-player.x)/d;shot.dy=(target.y-player.y)/d;}
  return shot;
}

export function resetAbilities(p){
  p.dodgeUntil=0;p.dodgeProtectedUntil=0;p.dodgeReadyAt=0;p.dodgeX=0;p.dodgeY=0;
  p.dodgeSerial??=0;p.dodgeQueued=0;p.speedUntil=0;p.hitShieldUntil=0;p.hitShield=0;
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
  p.facing=movementFacing(input,p.facing??0);
  if(input.dodge)startDodge(p,input.dodge,time-dt,input);
  const left=Math.max(0,Math.min(dt,(p.dodgeUntil??0)-(time-dt)));
  if(left>0){
    const x=p.x,y=p.y;p.previousX=x;p.previousY=y;
    advance(p,nav,p.dodgeX*RULES.dodgeDistance*left/RULES.dodgeSeconds,p.dodgeY*RULES.dodgeDistance*left/RULES.dodgeSeconds);
    p.pace=0;p.travel=Math.hypot(p.x-x,p.y-y)/dt;p.action=p.travel>.001?1:0;
    return;
  }
  const x=p.x,y=p.y;
  walkStep(p,nav,dt,time,input);
  if(p.speedUntil>time){
    advance(p,nav,(p.x-x)*RULES.speedBonus,(p.y-y)*RULES.speedBonus);
    p.travel=Math.hypot(p.x-x,p.y-y)/dt;
  }
}
