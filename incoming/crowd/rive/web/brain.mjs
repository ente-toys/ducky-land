// Host-side decisions only. All art, poses, names and speech are native Rive.
export const POSE = Object.freeze({idle:0, walk:1, quack:2, dance:3, sit:4, wave:5, look:6, preen:7, sleep:8});
const NAMES = ['quackers','mo','aya_22','bread_boy','pip','lulu','nori','miso','toto','sunny','peep','boba'];
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const R = 31;

export class CrowdBrain {
  constructor(layout, seed=2808) {
    this.layout=layout; this.scale=layout.groundScale; this.seed=seed>>>0;
    this.time=0; this.events=[]; this.party=null; this.nextParty=12;
    this.claims=new Map(); this.ducks=[]; this.keys=new Set();
    const starts=[[800,825],[250,704],[1350,703],[500,705],[1060,720],[720,755],
      [400,446],[800,410],[1200,446],[550,820],[1080,830],[626,834],[966,840]];
    starts.forEach(([x,y],i)=>this.ducks.push({id:i,player:i===0,name:i?NAMES[i-1]:'you',x,y,vx:0,vy:0,
      facing:1,action:0,poseUntil:0,goal:null,path:[],target:null,settled:false,
      nextThink:0,nextGreeting:2+i*.4,lastGoal:null,stuck:0,cap:i===0?8:1+(i*5)%13,
      city:i%4,shades:i%4===2?1+i%3:0,acc:i%3===1?1+i%7:0,shoes:i%3?1+i%10:0,
      social:.45+this.random()*.55,energy:.4+this.random()*.6}));
    this.player=this.ducks[0];
    this.assignSeat(this.ducks[1],layout.seats[0]);
    this.assignSeat(this.ducks[2],layout.seats[2]);
    for(let i=3;i<=5;i++) this.assignPlace(this.ducks[i],'fountain',layout.ring[i+3],12+i);
    for(let i=6;i<=8;i++) this.assignPlace(this.ducks[i],'stall',layout.stalls[(i-6)*2],9+i);
    this.idle(this.ducks[9],'sleep',12);
    this.idle(this.ducks[10],'preen',2.4);
    this.idle(this.ducks[11],'look',3);
    this.follow(this.ducks[12],11);
  }
  random() { let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296; }
  range(a,b) {return a+(b-a)*this.random();}
  pick(a) {return a[Math.floor(this.random()*a.length)];}
  distance(a,b) {return Math.hypot(a.x-b.x,(a.y-b.y)*this.scale);}
  emit(type,d,extra={}) {this.events.push({time:+this.time.toFixed(2),type,duck:d?.name,...extra});if(this.events.length>400)this.events.shift();}
  clear(x,y,ignore=null,pad=R) {
    const f=this.layout.floor;
    if(((x-f.x)/(f.rx-pad))**2+((y-f.y)/(f.ry-pad/this.scale))**2>1)return false;
    return !this.layout.obstacles.some(o=>o.name!==ignore&&Math.hypot(x-o.x,(y-o.y)*this.scale)<o.radius+pad);
  }
  line(a,b,ignore=null) {
    const n=Math.ceil(this.distance(a,b)/16);
    for(let i=1;i<=n;i++)if(!this.clear(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,ignore))return false;
    return true;
  }
  route(a,b,ignore=null) {
    if(this.line(a,b,ignore))return [{...b}];
    const grid=32, cols=51, rows=32;
    const point=k=>({x:(k%cols)*grid,y:Math.floor(k/cols)*grid});
    const nearest=p=>{
      let best=-1,dist=Infinity;
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
        const x=Math.round(p.x/grid)+dx,y=Math.round(p.y/grid)+dy;
        if(x<0||y<0||x>=cols||y>=rows)continue;
        const k=y*cols+x,q=point(k),l=this.distance(p,q);
        if(l<dist&&this.clear(q.x,q.y,ignore)&&this.line(p,q,ignore)){best=k;dist=l;}
      }return best;
    };
    const start=nearest(a),end=nearest(b); if(start<0||end<0)return [];
    const open=[start],g=new Map([[start,0]]),prev=new Map(),closed=new Set();
    while(open.length){
      let idx=0;
      for(let i=1;i<open.length;i++)if(g.get(open[i])+this.distance(point(open[i]),b)<g.get(open[idx])+this.distance(point(open[idx]),b))idx=i;
      const k=open.splice(idx,1)[0];
      if(k===end){
        const raw=[{...b}];let cur=k;
        while(cur!==start){raw.unshift(point(cur));cur=prev.get(cur);}raw.unshift(point(start));
        const short=[];let origin=a;
        while(raw.length){let j=raw.length-1;while(j>0&&!this.line(origin,raw[j],ignore))j--;short.push(raw[j]);origin=raw[j];raw.splice(0,j+1);}
        return short;
      }
      closed.add(k);const q=point(k);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const n=k+dx+dy*cols,p=point(n);
        if(n<0||n>=cols*rows||Math.abs(p.x-q.x)>grid||closed.has(n)||!this.clear(p.x,p.y,ignore)||!this.line(q,p,ignore))continue;
        const cost=g.get(k)+this.distance(q,p);
        if(cost<(g.get(n)??Infinity)){g.set(n,cost);prev.set(n,k);if(!open.includes(n))open.push(n);}
      }
    }return [];
  }
  release(d) {if(d.goal?.claim)this.claims.delete(d.goal.claim);d.lastGoal=d.goal?.kind;d.goal=null;d.path=[];d.settled=false;d.action=0;d.vx=d.vy=0;}
  destination(d,p,ignore=null) {d.target={x:p.x,y:p.y};d.path=this.clear(p.x,p.y,ignore)?this.route(d,d.target,ignore):[];d.routeFailed=!d.path.length;d.stuck=0;}
  assignPlace(d,kind,p,duration) {
    const claim=kind+':'+p.id;if(this.claims.has(claim)&&this.claims.get(claim)!==d.id)return false;
    this.release(d);this.claims.set(claim,d.id);d.goal={kind,claim,place:p,duration,started:this.time,deadline:this.time+24};
    this.destination(d,p);this.emit('goal',d,{goal:kind});return true;
  }
  assignSeat(d,s) {
    if(!this.assignPlace(d,'bench',s,this.range(15,23)))return false;
    d.goal.phase='approach';this.destination(d,{x:s.x,y:s.approachY});return true;
  }
  idle(d,kind,duration) {this.release(d);d.goal={kind,started:this.time,ends:this.time+duration};d.settled=true;d.action=POSE[kind]??0;this.emit(kind,d);}
  follow(d,seconds=this.range(7,12)) {
    this.release(d);d.goal={kind:'follow',ends:this.time+seconds,offset:(d.id%2?1:-1)*this.range(70,100),nextPath:0};
    this.emit('follow',d);
  }
  choose(d) {
    const seats=this.layout.seats.filter(s=>!this.claims.has('bench:'+s.id));
    const ring=this.layout.ring.filter(s=>!this.claims.has('fountain:'+s.id));
    const stalls=this.layout.stalls.filter(s=>!this.claims.has('stall:'+s.id));
    // Individual preferences plus continuity, with a short memory against repeats.
    const options=[['bench',seats.length&&d.lastGoal!=='bench'?.21:0],['fountain',ring.length?.24:0],
      ['stall',stalls.length&&d.lastGoal!=='stall'?.23:0],['follow',this.distance(d,this.player)<390&&d.lastGoal!=='follow'?.16*d.social:0],
      ['look',.12],['preen',.09],['sleep',d.energy<.55?.12:.035]];
    let roll=this.random()*options.reduce((a,[,w])=>a+w,0),kind='look';
    for(const [k,w]of options){roll-=w;if(roll<=0){kind=k;break;}}
    if(kind==='bench')this.assignSeat(d,this.pick(seats));
    else if(kind==='fountain')this.assignPlace(d,kind,this.pick(ring),this.range(9,17));
    else if(kind==='stall')this.assignPlace(d,kind,this.pick(stalls),this.range(6,11));
    else if(kind==='follow'){
      this.follow(d);
    }else this.idle(d,kind,kind==='sleep'?this.range(9,16):kind==='look'?3:2.4);
  }
  face(d,p){if(Math.abs(p.x-d.x)>12)d.facing=p.x<d.x?-1:1;}
  pose(d,name,seconds) {d.action=POSE[name];d.poseUntil=this.time+seconds;d.vx=d.vy=0;}
  greet(d,force=false) {
    if(d.player||this.time<d.nextGreeting||(!force&&this.distance(d,this.player)>155))return false;
    if(['bench','sleep','dance'].includes(d.goal?.kind))return false;
    d.nextGreeting=this.time+this.range(18,30);this.face(d,this.player);
    const name=force||this.random()<.7?'wave':'quack';this.pose(d,name,name==='wave'?1.5:1.25);this.emit(name,d,{to:'you'});return true;
  }
  quack() {
    this.player.tapping=false;this.pose(this.player,'quack',1.25);this.emit('quack',this.player);
    let count=0;
    for(const d of [...this.ducks.slice(1)].sort((a,b)=>this.distance(a,this.player)-this.distance(b,this.player)))
      if(count<3&&this.distance(d,this.player)<300&&this.greet(d,true))count++;
  }
  startParty(leader=this.player) {
    if(this.party){if(leader.player)this.endParty();else return false;}
    const candidates=this.ducks.slice(1).filter(d=>d!==leader&&!['bench','sleep'].includes(d.goal?.kind))
      .sort((a,b)=>this.distance(a,leader)-this.distance(b,leader));
    const size=Math.min(3+Math.floor(this.random()*4),candidates.length+1);
    if(size<3)return false;
    const members=[leader,...candidates.slice(0,size-1)],ends=this.time+this.range(14,18);
    // NPCs make room in a forecourt before gathering. A fountain-edge leader
    // otherwise funnels all its guests through the same narrow gap.
    const centers=leader.player?[{x:leader.x,y:leader.y}]:[
      {x:520,y:785},{x:1080,y:785},{x:800,y:865}
    ].filter(p=>this.distance(p,this.player)>170).sort((a,b)=>this.distance(a,leader)-this.distance(b,leader));
    const center=centers.find(p=>this.clear(p.x,p.y))??{x:leader.x,y:leader.y};
    this.party={members:members.map(d=>d.id),ends,leader:leader.id};this.nextParty=ends+this.range(20,36);
    members.forEach((d,i)=>{
      this.release(d);d.poseUntil=0;
      d.goal={kind:'dance',ends,leader:leader.id};
      if(i===0){
        if(this.distance(d,center)<10){d.settled=true;this.pose(d,'dance',ends-this.time);}
        else this.destination(d,center);
        return;
      }
      const angle=(i-1)/(size-1)*Math.PI*2-Math.PI/2;
      let dest=null;
      for(const radius of [130,165,205]){
        const p={x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius/this.scale};
        if(this.clear(p.x,p.y)&&members.slice(0,i).every(o=>!o.target||this.distance(p,o.target)>95)
          &&this.ducks.filter(o=>!members.includes(o)&&o.settled).every(o=>this.distance(p,o)>85)){dest=p;break;}
      }
      if(!dest){dest=this.layout.ring.filter(p=>this.clear(p.x,p.y)).sort((a,b)=>this.distance(a,leader)-this.distance(b,leader))[i-1];}
      this.destination(d,dest);d.goal.deadline=ends;
    });
    this.emit('party',leader,{members:members.map(d=>d.name),size});return true;
  }
  endParty(){if(!this.party)return;for(const id of this.party.members){const d=this.ducks[id];if(d.goal?.kind==='dance'){this.release(d);d.poseUntil=0;d.action=0;if(!d.player)d.nextThink=this.time+this.range(.3,2);}}this.emit('party-end',null);this.party=null;}
  tap(x,y){if(!this.clear(x,y))return false;if(this.player.goal?.kind==='dance')this.endParty();this.player.poseUntil=0;this.player.tapping=true;this.destination(this.player,{x,y});return true;}
  // Steering is acceleration-limited; a short look-ahead chooses a side around neighbours.
  move(d,dt,speed=100,ignore=null) {
    while(d.path.length&&this.distance(d,d.path[0])<6)d.path.shift();
    if(!d.path.length){d.vx=d.vy=0;return !d.routeFailed;}
    const p=d.path[0],dx=p.x-d.x,dy=(p.y-d.y)*this.scale,l=Math.hypot(dx,dy),final=d.path.length===1;
    const pace=Math.min(speed,final?l*3.6:speed);let vx=dx/l*pace,vy=dy/l*pace;
    for(const o of this.ducks){
      if(o===d)continue;
      const ox=d.x-o.x,oy=(d.y-o.y)*this.scale,dist=Math.hypot(ox,oy)||.1;
      if(dist<105){const force=(1-dist/105)*105;vx+=ox/dist*force;vy+=oy/dist*force;
        // Stable handedness avoids two ducks repeatedly mirroring each other.
        if(dist<92&&dx*(o.x-d.x)+dy*(o.y-d.y)*this.scale>0){vx+=-dy/l*28;vy+=dx/l*28;}}
    }
    // Circle repulsion keeps corners soft; the route supplies the large-scale detour.
    for(const o of this.layout.obstacles){if(o.name===ignore)continue;const ox=d.x-o.x,oy=(d.y-o.y)*this.scale,dist=Math.hypot(ox,oy),edge=dist-o.radius-R;
      if(edge<42&&dist){vx+=ox/dist*(42-edge)*2.7;vy+=oy/dist*(42-edge)*2.7;}}
    const limit=Math.hypot(vx,vy);if(limit>speed){vx*=speed/limit;vy*=speed/limit;}
    const a=1-Math.exp(-dt*9);d.vx+=(vx-d.vx)*a;d.vy+=(vy-d.vy)*a;
    const nx=d.x+d.vx*dt,ny=d.y+d.vy*dt/this.scale,oldx=d.x,oldy=d.y;
    if(this.clear(nx,ny,ignore)){d.x=nx;d.y=ny;}else if(this.clear(nx,d.y,ignore))d.x=nx;else if(this.clear(d.x,ny,ignore))d.y=ny;
    if(Math.abs(d.vx)>13)d.facing=d.vx<0?-1:1;
    d.action=Math.hypot(d.vx,d.vy)>12?POSE.walk:POSE.idle;
    d.stuck=this.distance({x:oldx,y:oldy},d)<dt*9?d.stuck+dt:0;
    if(d.stuck>1.8){this.destination(d,d.target,ignore);d.stuck=0;}
    return final&&l<9;
  }
  arrived(d){
    const g=d.goal;if(!g)return;
    if(g.kind==='bench'&&g.phase==='dock'){
      // Last few ground units settle exactly on the seat, never below its top.
      d.x=g.place.x;d.y=g.place.y;
    }
    if(g.kind==='bench'&&g.phase==='approach'){
      g.phase='dock';this.destination(d,g.place,g.place.prop);return;
    }
    d.settled=true;d.path=[];d.vx=d.vy=0;g.ends=g.ends??this.time+g.duration;
    if(g.kind==='bench'){d.action=POSE.sit;this.emit('sit',d,{seat:g.place.id});}
    else if(g.kind==='dance'){this.pose(d,'dance',g.ends-this.time);this.emit('dance',d);}
    else {d.action=POSE.look;d.nextIdle=this.time+3;this.emit(g.kind==='stall'?'visit':'gather',d,{place:g.place.id});}
  }
  updateNPC(d,dt){
    if(this.time<d.poseUntil)return;
    if(this.greet(d))return;
    let g=d.goal;
    if(!g){if(this.time>=d.nextThink)this.choose(d);return;}
    if(g.ends&&this.time>=g.ends){
      if(g.kind==='bench'&&g.phase!=='leave'){
        g.phase='leave';g.ends=0;g.deadline=this.time+8;d.settled=false;d.action=0;this.destination(d,{x:g.place.x,y:g.place.approachY},g.place.prop);return;
      }
      this.release(d);d.action=0;d.nextThink=this.time+this.range(.4,1.5);d.energy=this.range(.3,1);return;
    }
    if(g.kind==='follow'){
      const dest={x:this.player.x+g.offset,y:this.player.y+65};
      if(this.distance(d,this.player)>500){g.ends=this.time;return;}
      if(this.time>g.nextPath){g.nextPath=this.time+.75;if(this.clear(dest.x,dest.y))this.destination(d,dest);}
      if(this.distance(d,this.player)<105){d.action=0;d.vx=d.vy=0;this.face(d,this.player);}else this.move(d,dt,115);
      return;
    }
    if(d.settled){
      if(g.kind==='bench'){d.action=POSE.sit;return;}
      if(['look','preen','sleep'].includes(g.kind)){d.action=POSE[g.kind];return;}
      if(g.kind==='dance'){d.action=POSE.dance;return;}
      this.face(d,g.kind==='fountain'?this.layout.fountain:{x:g.place.x,y:g.place.y-120});
      if(this.time>d.nextIdle){const pose=this.random()<.32?'preen':'look';this.pose(d,pose,pose==='preen'?2.4:3);d.nextIdle=this.time+this.range(3.3,6);}
      return;
    }
    const ignore=g.kind==='bench'&&g.phase!=='approach'?g.place.prop:null;
    if(this.move(d,dt,g.phase==='dock'||g.phase==='leave'?65:94+d.social*18,ignore)){
      if(g.phase==='leave'){this.release(d);d.action=0;d.nextThink=this.time+.8;}else this.arrived(d);
    }
    if(g.deadline&&this.time>g.deadline&&!d.settled){
      this.emit('replan',d,{goal:g.kind});
      // Never abandon an occupied bench while the root is still inside its collider.
      if(g.kind==='bench'&&g.phase!=='approach'){
        g.phase='leave';g.ends=0;g.deadline=this.time+8;
        this.destination(d,{x:g.place.x,y:g.place.approachY},g.place.prop);
      }else{this.release(d);d.nextThink=this.time+.5;}
    }
  }
  updatePlayer(dt){
    const d=this.player;let x=0,y=0;
    if(this.keys.has('a')||this.keys.has('arrowleft'))x--;
    if(this.keys.has('d')||this.keys.has('arrowright'))x++;
    if(this.keys.has('w')||this.keys.has('arrowup'))y--;
    if(this.keys.has('s')||this.keys.has('arrowdown'))y++;
    if(x||y){
      if(d.goal?.kind==='dance')this.endParty();d.tapping=false;d.poseUntil=0;
      const length=Math.hypot(x,y),nx=d.x+x/length*160*dt,ny=d.y+y/length*160*dt;
      const open=(x,y)=>this.clear(x,y)&&this.ducks.slice(1).every(o=>this.distance({x,y},o)>=R*2||this.distance({x,y},o)>=this.distance(d,o));
      if(open(nx,ny)){d.x=nx;d.y=ny;}else if(open(nx,d.y))d.x=nx;else if(open(d.x,ny))d.y=ny;
      if(x)d.facing=x<0?-1:1;d.action=POSE.walk;return;
    }
    if(this.time<d.poseUntil)return;
    if(d.tapping){if(this.move(d,dt,165)){d.tapping=false;d.action=0;}return;}
    d.action=d.goal?.kind==='dance'?POSE.dance:POSE.idle;
  }
  separate(){
    for(let i=0;i<this.ducks.length;i++)for(let j=i+1;j<this.ducks.length;j++){
      const a=this.ducks[i],b=this.ducks[j],dx=b.x-a.x,dy=(b.y-a.y)*this.scale,dist=Math.hypot(dx,dy);
      if(dist>=R*2||dist<.01)continue;
      const fixed=d=>d.player||d.settled||d.goal?.phase==='dock'||d.goal?.phase==='leave';
      const fa=fixed(a),fb=fixed(b);if(fa&&fb)continue;
      const amount=(R*2-dist+.05)/(fa||fb?1:2);
      for(const [d,sign,lock]of [[a,-1,fa],[b,1,fb]])if(!lock){
        const x=d.x+sign*dx/dist*amount,y=d.y+sign*dy/dist*amount/this.scale;
        const ignore=d.goal?.kind==='bench'&&d.goal.phase!=='approach'?d.goal.place.prop:null;
        if(this.clear(x,y,ignore)){d.x=x;d.y=y;}
      }
    }
  }
  update(dt){
    this.time+=dt;
    if(this.party&&this.time>this.party.ends)this.endParty();
    this.updatePlayer(dt);
    for(const d of this.ducks.slice(1))this.updateNPC(d,dt);
    this.separate();
    if(!this.party&&this.time>this.nextParty){
      const eligible=this.ducks.slice(1).filter(d=>!['bench','sleep','follow'].includes(d.goal?.kind)&&d.y>710&&this.clear(d.x,d.y));
      if(eligible.length)this.startParty(this.pick(eligible));else this.nextParty=this.time+3;
    }
  }
  renderSlots(){
    // A nested state machine belongs to its placement. Pin a short gesture to
    // that placement until it ends, instead of restarting it on a y-sort swap.
    const previous=this.renderOrder??Array(32).fill(null),order=Array(32).fill(null);
    for(const offset of [0,16]){
      const actors=this.ducks.filter(d=>(d.y<610)===(offset===0)).sort((a,b)=>a.y-b.y);
      const pinned=new Set();
      for(let i=offset;i<offset+16;i++){
        const d=previous[i];
        if(d&&actors.includes(d)&&[2,5,6,7].includes(d.action)&&this.time<d.poseUntil){order[i]=d;pinned.add(d);}
      }
      const remaining=actors.filter(d=>!pinned.has(d));
      for(let i=offset;i<offset+16;i++)if(!order[i])order[i]=remaining.shift()??null;
    }
    this.renderOrder=order;return order;
  }
  snapshot(){return {time:+this.time.toFixed(2),party:this.party,ducks:this.ducks.map(d=>({id:d.id,name:d.name,x:+d.x.toFixed(1),y:+d.y.toFixed(1),goal:d.goal?.kind,phase:d.goal?.phase,action:d.action,settled:d.settled})),events:this.events};}
}
