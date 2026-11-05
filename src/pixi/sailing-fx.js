// boss 5 Nov: getting in, sailing and getting out. Client-only feel on top of the server's instant mode switch:
// Ducky walks to the jetty end, squashes, hops into the boat (dip + cream ring); boats turn, heel, bob and leave a
// foam V; at a dock Ducky stands, hops onto the jetty with dust, and the empty boat rocks. Server flow is untouched.
import {Assets, Container, Graphics, Sprite} from 'pixi.js';
import {HARBOR, boardingPoint} from './islands.js';
import {PALETTE} from './palette.js';

const PUFF='/pixi-art/detail/fx--puff-small.svg';
export const DUCK_SCALE=.88*.24*3, SEAT_SCALE=.8;
const SEAT={x:24,y:0};   // where the Ducky's feet sit in the hull, boat facing east (boat-sail.png, 170 wide)
const HOLD=.6;
const WAKE=1.1;   // seconds a foam point lives: the V is about 400 units long at full sail   // the most a boarding or landing holds back the steering, in seconds
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,u)=>a+(b-a)*u, smooth=u=>u*u*(3-2*u);
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const clock=()=>performance.now()/1000/(globalThis.__duckySailSlow||1);   // QA: ?sailslow=4 plays the hops 4x slower for frame grabs
if (globalThis.location) globalThis.__duckySailSlow=Number(new URLSearchParams(location.search).get('sailslow'))||1;
const phaseOf=id=>{let h=7;for (const c of String(id)) h=(h*31+c.charCodeAt(0))>>>0;return h%6283/1000;};
const rim=x=>-21-12*Math.min(1.6,(x/62)**2);   // front rim of the hull opening, boat-local, the seat mask follows it
// the jetty end a Ducky stands on beside a boat: the sea end of the harbor pier, as close to the boat as it reaches
export function standFor(boat) {   // boss 5 Nov: the jetty deck beside that boat, the same point the server boards from
  return boat ? boardingPoint(boat) : {x:HARBOR.land.x,y:HARBOR.land.y};
}

// a Ducky (or its dust) on the jetty deck draws over the deck, which lies flat and sorts by its far (land) end
const onPier=(x,y)=>{const p=HARBOR.pier; return p && x>=p.x-10 && x<=p.x+p.width+10 && y>=p.y-30 && y<=p.y+p.height;};
const deckZ=(x,y)=>onPier(x,y)?Math.max(y,HARBOR.pier.y+HARBOR.pier.height)+1:y;

export async function createSailingFX({water,objects}) {
  await Assets.load(PUFF).catch(()=>null);
  const wakes=new Graphics({label:'Boat wakes'}), rings=new Graphics({label:'Boarding rings'});
  water.addChild(wakes,rings);
  const boats=new Map(), ducks=new Map(), splashes=[], dust=[];
  let last=clock();
  const fx={waterSplash:null};

  function ring(x,y,size=1) {
    splashes.push({x,y,born:clock(),size});
    fx.waterSplash?.(x,y);
  }
  function puffs(x,y) {
    const texture=Assets.get(PUFF);
    if (!texture) return;
    for (let i=0;i<4;i++) {
      const sprite=new Sprite(texture), side=i<2?-1:1;
      sprite.anchor.set(.5,.9); sprite.tint=PALETTE.cream; sprite.zIndex=deckZ(x,y)+(i%2?2:-1);
      objects.addChild(sprite);
      dust.push({sprite,x:x+side*14,y,vx:side*(34+i%2*26),vy:-(10+i%2*12),born:clock(),scale:.075+.03*(i%2)});
    }
  }
  // the transform a boat is drawn with this frame: anchor position, roll, flip and the seat in world space
  function seatOf(s) {
    const sx=SEAT.x*s.face*s.squeeze, sy=SEAT.y, c=Math.cos(s.roll), n=Math.sin(s.roll);
    return {x:s.x+sx*c-sy*n,y:s.y+s.bob+sx*n+sy*c,roll:s.roll};
  }
  function maskOf(s) {
    const c=Math.cos(s.roll), n=Math.sin(s.roll), points=[], k=Math.abs(s.face)*s.squeeze, ox=SEAT.x*s.face*s.squeeze;
    const add=(x,y)=>points.push(s.x+x*c-y*n,s.y+s.bob+x*n+y*c);
    add(ox-120,-320);
    for (let x=-110;x<=110;x+=10) add(ox+x,rim((ox+x)/Math.max(.2,k)));
    add(ox+120,-320);
    return points;
  }

  return Object.assign(fx,{
    standFor,
    reset() {ducks.clear(); boats.clear(); splashes.length=0; for (const d of dust.splice(0)) d.sprite.destroy();},
    // boss 5 Nov: one boat sprite per frame. Smooth heading (no snapping), flip through a squeeze, heel into turns,
    // bob and roll out of phase, the dip of a landing Ducky, the rock of an emptied boat, a foam V and bow ripples
    boat(entry,boat,reduced) {
      const now=clock();
      let s=boats.get(boat.id);
      if (!s) {
        s={x:boat.x,y:boat.y,heading:boat.turn??Math.PI,face:1,faceGoal:1,squeeze:1,lean:0,rate:0,roll:0,bob:0,dip:0,dipV:0,rock:0,rockV:0,
          phase:phaseOf(boat.id),trail:[],emit:null,occupant:boat.occupant,glide:null,seen:now,last:now};
        boats.set(boat.id,s);
      }
      const dt=clamp(now-s.last,0,.1); s.last=now; s.seen=now;
      const jump=Math.hypot(boat.x-s.x,boat.y-s.y);
      if (s.occupant && !boat.occupant) {   // emptied: the boat rocks, and slides to its berth instead of popping there
        s.rockV+=reduced?0:.55; s.dipV+=reduced?0:28;
        if (jump>20 && jump<600 && !reduced) s.glide={fx:s.x,fy:s.y,start:now};
        s.trail.length=0;
      }
      if (!s.occupant && boat.occupant) s.trail.length=0;
      s.occupant=boat.occupant;
      const px=s.x, py=s.y;
      if (s.glide) {
        const u=clamp((now-s.glide.start)/1.1,0,1), e=1-(1-u)**3;
        s.x=lerp(s.glide.fx,boat.x,e); s.y=lerp(s.glide.fy,boat.y,e);
        if (u>=1) s.glide=null;
      } else {s.x=boat.x; s.y=boat.y;}
      const speed=dt?Math.hypot(s.x-px,s.y-py)/dt:0, moving=boat.occupant && (boat.travel>1 || speed>25);
      const goal=boat.occupant || s.glide ? boat.turn ?? s.heading : s.heading;
      const before=Math.sin(s.heading);
      s.heading+=angleDiff(goal,s.heading)*(reduced?1:1-Math.exp(-dt*5));
      const sideways=Math.sin(s.heading);
      if (boat.occupant) {if (sideways>.2) s.faceGoal=1; else if (sideways<-.2) s.faceGoal=-1;}
      if (s.face!==s.faceGoal) {s.face=s.faceGoal; s.dipV-=60;}   // boss 5 Nov: the boat flips sides at once (a squeezed sliver read badly), with a small dip
      s.rate=lerp(s.rate,dt?(sideways-before)/dt:0,1-Math.exp(-dt*6));
      s.squeeze=1;   // boss 5 Nov: no narrowing when heading north or south
      s.lean=reduced?0:lerp(s.lean,clamp(s.rate*.16+(moving?sideways*.05:0),-.2,.2),1-Math.exp(-dt*5));
      s.dipV+=(-110*s.dip-8*s.dipV)*dt; s.dip+=s.dipV*dt;
      s.rockV+=(-34*s.rock-1.9*s.rockV)*dt; s.rock+=s.rockV*dt;
      s.bob=reduced?0:Math.sin(now*1.5+s.phase)*2.6+(moving?Math.sin(now*4.2+s.phase)*1.2:0)+s.dip;
      s.roll=reduced?0:Math.sin(now*1.1+s.phase*1.3)*.028+s.rock+s.lean*.25;
      const {root,sprite}=entry, base=Math.abs(sprite.scale.y);
      root.position.set(s.x,s.y+s.bob);
      root.rotation=s.roll;
      sprite.scale.x=base*(Math.sign(s.face)||1)*Math.max(.1,Math.abs(s.face))*s.squeeze;
      sprite.skew.x=0;   // boss 5 Nov: no skew, the sprite kept its shape; the heel is a small roll only
      // foam V: points dropped at the stern spread sideways and fade; the bow pushes small crescents ahead
      if (moving && !reduced) {
        const dx=Math.sin(s.heading), dy=Math.cos(s.heading), stern={x:s.x-dx*70,y:s.y-dy*24-4};
        if (!s.emit || Math.hypot(stern.x-s.emit.x,stern.y-s.emit.y)>12) {
          s.trail.push({...stern,nx:-dy,ny:dx*.45,born:now}); s.emit=stern;
          if (s.trail.length>48) s.trail.shift();
        }
        s.bow={x:s.x+dx*78,y:s.y+dy*22-4,a:Math.atan2(dy*.45,dx),born:s.bow?.born??now};
      } else s.bow=null;
      while (s.trail.length && now-s.trail[0].born>WAKE) s.trail.shift();
      return seatOf(s);
    },
    // per frame, after every boat: wakes, rings, dust; boats and Duckies not seen for a while are forgotten
    draw(reduced) {
      const now=clock(); last=now;
      wakes.clear(); rings.clear();
      for (const [id,s] of boats) {
        if (now-s.seen>3) {boats.delete(id); continue;}
        if (reduced || now-s.seen>.2) continue;
        const t=s.trail;
        for (const side of [-1,1]) for (let i=1;i<t.length;i++) {
          const a=t[i-1], b=t[i], ageA=now-a.born, ageB=now-b.born, fade=1-ageA/WAKE, alpha=.8*fade;
          if (alpha<=0) continue;
          const wa=14+ageA*120, wb=14+ageB*120;
          wakes.moveTo(a.x+a.nx*wa*side,a.y+a.ny*wa*side).lineTo(b.x+b.nx*wb*side,b.y+b.ny*wb*side)
            .stroke({color:PALETTE.cream,width:12*fade+2,alpha,cap:'round'});
        }
        for (let i=0;i<t.length;i+=3) {
          const p=t[i], age=now-p.born, alpha=.7*(1-age/.8);   // churned foam down the middle
          if (alpha>0) wakes.circle(p.x+Math.sin(i*2.3)*6,p.y+Math.cos(i*1.7)*3,7*(1-age/.8)+1).fill({color:PALETTE.cream,alpha});
        }
        if (s.bow) for (let k=0;k<2;k++) {
          const u=((now-s.bow.born)*1.4+k*.5)%1, r=16+u*34;
          wakes.moveTo(s.bow.x+Math.cos(s.bow.a-1)*r,s.bow.y+Math.sin(s.bow.a-1)*r*.5)
            .quadraticCurveTo(s.bow.x+Math.cos(s.bow.a)*r*1.25,s.bow.y+Math.sin(s.bow.a)*r*.62,s.bow.x+Math.cos(s.bow.a+1)*r,s.bow.y+Math.sin(s.bow.a+1)*r*.5)
            .stroke({color:PALETTE.cream,width:6*(1-u)+2,alpha:.85*(1-u),cap:'round'});
        }
      }
      for (let i=splashes.length-1;i>=0;i--) {
        const r=splashes[i], u=(now-r.born)/.8;
        if (u>=1 || reduced) {splashes.splice(i,1); continue;}
        for (const [delay,grow] of [[0,1],[.18,.7]]) {
          const v=clamp((u-delay)/(1-delay),0,1), e=1-(1-v)**2.4;
          if (v<=0 || v>=1) continue;
          rings.ellipse(r.x,r.y+6,(50+e*90*grow)*r.size,(18+e*34*grow)*r.size).stroke({color:PALETTE.cream,width:9*(1-v)+2,alpha:.95*(1-v)});
        }
        if (u<.4) for (let k=0;k<5;k++) {   // a few droplets thrown up and out
          const a=Math.PI*(k<2?.8+k*.12:.2-(k-2)*.1), d=70+u*110;   // droplets thrown out past both ends of the hull
          rings.circle(r.x+Math.cos(a)*d,r.y-10-Math.sin(a)*30*(1-u/.4)+u*u*40,6*(1-u/.4)).fill({color:PALETTE.cream,alpha:.95});
        }
      }
      for (let i=dust.length-1;i>=0;i--) {
        const d=dust[i], u=(now-d.born)/.55;
        if (u>=1) {d.sprite.destroy(); dust.splice(i,1); continue;}
        const e=1-(1-u)**2;
        d.sprite.position.set(d.x+d.vx*e,d.y+d.vy*e);
        d.sprite.scale.set(d.scale*(.7+e*.6)); d.sprite.alpha=.8*(1-u);
      }
      for (const [id,d] of ducks) if (now-d.seen>3) ducks.delete(id);
    },
    // true while a Ducky's own boarding or landing should hold the steering back (at most HOLD seconds)
    holding(id) {const d=ducks.get(id); return Boolean(d?.anim && clock()-d.anim.start<HOLD);},
    // boss 5 Nov: how to draw a live Ducky this frame. Mode changes start a hop; seated Duckies ride their boat's seat
    duck(pose,reduced) {
      const now=clock(), sailing=pose.mode==='sailing';
      let d=ducks.get(pose.id);
      if (!d) {d={mode:pose.mode,x:pose.x,y:pose.y,anim:null,boatId:pose.boatId}; ducks.set(pose.id,d);}
      d.seen=now;
      const boatState=()=>{
        for (const [id,s] of boats) if (s.occupant===pose.id) return {id,s};
        return d.boatId && boats.get(d.boatId) ? {id:d.boatId,s:boats.get(d.boatId)} : null;
      };
      if (d.mode!==pose.mode) {
        if (sailing) d.anim={kind:'board',start:now,from:{x:d.x,y:d.y},landed:false};
        else {
          const b=d.boatId && boats.get(d.boatId);
          d.anim={kind:'land',start:now,from:{x:d.x,y:d.y},stand:standFor(b||{x:d.x,y:d.y}),landed:false,mask:d.mask};
        }
        d.mode=pose.mode;
      }
      const found=sailing?boatState():null;
      if (found) d.boatId=found.id;
      const seat=found?seatOf(found.s):{x:pose.x+SEAT.x,y:pose.y+SEAT.y,roll:0};
      const out={x:pose.x,y:pose.y,scale:sailing?DUCK_SCALE*SEAT_SCALE:DUCK_SCALE,sx:1,sy:1,rotation:0,alpha:1,mask:null,
        speed:pose.travel,turn:pose.turn,deck:!sailing};
      const seated=()=>{Object.assign(out,{x:seat.x,y:seat.y,rotation:seat.roll*.8,mask:found?maskOf(found.s):null,deck:false});};
      if (sailing) seated();
      const a=d.anim;
      if (a && reduced) {   // reduced motion: no arcs, the Ducky fades out where it was and in where it is
        const u=(now-a.start)/.45;
        if (u>=1) d.anim=null;
        else if (u<.45) Object.assign(out,{x:a.from.x,y:a.from.y,alpha:1-u/.45,mask:null,deck:a.kind==='board',
          scale:a.kind==='board'?DUCK_SCALE:DUCK_SCALE*SEAT_SCALE,speed:0});
        else out.alpha=(u-.45)/.55;
      } else if (a?.kind==='board') {
        const stand=standFor(found?.s||seat), walk=Math.hypot(stand.x-a.from.x,stand.y-a.from.y), tw=clamp(walk/360,0,.45), tq=.12, th=.4, ts=.34;
        const e=now-a.start, hop=Math.hypot(seat.x-stand.x,seat.y-stand.y);
        if (e<tw) {
          const u=e/tw;
          Object.assign(out,{x:lerp(a.from.x,stand.x,u),y:lerp(a.from.y,stand.y,u),scale:DUCK_SCALE,mask:null,deck:true,speed:360,
            turn:Math.atan2(stand.x-a.from.x,stand.y-a.from.y),rotation:0});
        } else if (e<tw+tq) {
          const u=(e-tw)/tq, k=Math.sin(Math.PI*u);
          Object.assign(out,{x:stand.x,y:stand.y,scale:DUCK_SCALE,mask:null,deck:true,speed:0,sx:1+.14*k,sy:1-.2*k,rotation:0,
            turn:Math.atan2(seat.x-stand.x,seat.y-stand.y)});
        } else if (e<tw+tq+th) {
          const u=(e-tw-tq)/th, m=smooth(u), lift=(70+hop*.3)*4*u*(1-u);
          Object.assign(out,{x:lerp(stand.x,seat.x,m),y:lerp(stand.y,seat.y,m)-lift,scale:lerp(DUCK_SCALE,DUCK_SCALE*SEAT_SCALE,m),
            sx:1-.08*Math.sin(Math.PI*u),sy:1+.12*Math.sin(Math.PI*u),deck:false,speed:0,rotation:(seat.x-stand.x>0?1:-1)*.12*Math.sin(Math.PI*u),
            turn:Math.atan2(seat.x-stand.x,seat.y-stand.y),mask:u>.55?out.mask:null});
        } else if (e<tw+tq+th+ts) {
          if (!a.landed) {a.landed=true; if (found) {found.s.dipV+=95; found.s.rockV+=(seat.x>stand.x?1:-1)*.25;} ring(seat.x,(found?.s.y??seat.y)-2);}
          const u=(e-tw-tq-th)/ts, k=Math.sin(Math.PI*Math.min(1,u*1.5))*(1-u*.4);
          Object.assign(out,{sx:1+.12*k,sy:1-.16*k,y:out.y+5*k});
        } else d.anim=null;
      } else if (a?.kind==='land') {
        const stand=a.stand, tr=.16, th=.4, tl=.24, walk=Math.hypot(pose.x-stand.x,pose.y-stand.y), tw=clamp(walk/320,0,.75);
        const e=now-a.start, from=a.from;
        if (e<tr) {   // stands up out of the seat
          const u=e/tr, k=Math.sin(Math.PI*u*.5);
          Object.assign(out,{x:from.x,y:from.y-10*k,scale:DUCK_SCALE*SEAT_SCALE,sx:1-.06*k,sy:1+.1*k,mask:a.mask??null,deck:false,speed:0,
            turn:Math.atan2(stand.x-from.x,stand.y-from.y)});
        } else if (e<tr+th) {
          const u=(e-tr)/th, m=smooth(u), lift=(60+Math.hypot(stand.x-from.x,stand.y-from.y)*.3)*4*u*(1-u);
          if (!a.pushed) {a.pushed=true; const b=boats.get(d.boatId); if (b) {b.rockV+=(stand.x>from.x?-1:1)*.35; b.dipV+=40;}}
          Object.assign(out,{x:lerp(from.x,stand.x,m),y:lerp(from.y-10,stand.y,m)-lift,scale:lerp(DUCK_SCALE*SEAT_SCALE,DUCK_SCALE,m),
            sx:1-.08*Math.sin(Math.PI*u),sy:1+.12*Math.sin(Math.PI*u),mask:u<.35?a.mask??null:null,deck:false,speed:0,rotation:(stand.x>from.x?1:-1)*.12*Math.sin(Math.PI*u),
            turn:Math.atan2(stand.x-from.x,stand.y-from.y)});
        } else if (e<tr+th+tl) {
          if (!a.landed) {a.landed=true; puffs(stand.x,stand.y);}
          const u=(e-tr-th)/tl, k=Math.sin(Math.PI*Math.min(1,u*1.4))*(1-u*.3);
          Object.assign(out,{x:stand.x,y:stand.y,scale:DUCK_SCALE,sx:1+.16*k,sy:1-.22*k,mask:null,deck:true,speed:0,
            turn:Math.atan2(pose.x-stand.x,pose.y-stand.y)});
        } else if (e<tr+th+tl+tw) {
          const u=(e-tr-th-tl)/tw;
          Object.assign(out,{x:lerp(stand.x,pose.x,u),y:lerp(stand.y,pose.y,u),scale:DUCK_SCALE,mask:null,deck:true,speed:320,
            turn:Math.atan2(pose.x-stand.x,pose.y-stand.y)});
        } else d.anim=null;
      }
      out.z=out.deck?deckZ(out.x,out.y):out.y+14;   // seated or hopping draws over its own hull (boat at y+2)
      if (sailing && !d.anim) d.mask=out.mask;
      d.x=out.x; d.y=out.y;
      return out;
    },
  });
}
