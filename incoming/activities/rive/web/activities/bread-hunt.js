// Portable rules, no DOM or Rive dependency. All visual effects belong to the .riv.
export const WALK_SPEED = 220;
export function walkable(x, y) {
  return ((x-800)/555)**2+((y-640)/282)**2<=1 && ((x-800)/265)**2+((y-575)/132)**2>=1;
}
export const BREAD_SPOTS = [[970,835],[1150,745],[1220,625],[1150,480],[970,405],[800,390],
  [625,410],[455,480],[380,625],[450,745],[620,835],[800,886]];

// Small navigation mesh around the fountain. The returned route respects its collision ellipse.
function lineClear(a,b) {
  const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/10));
  for(let i=0;i<=n;i++) if(!walkable(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n)) return false;
  return true;
}
export function routeTo(from,to) {
  if(!walkable(to.x,to.y)) return [];
  if(lineClear(from,to)) return [to];
  const nodes=[{x:from.x,y:from.y},to];
  for(let i=0;i<32;i++) {
    const a=i*Math.PI/16, p={x:800+315*Math.cos(a),y:575+173*Math.sin(a)};
    if(walkable(p.x,p.y)) nodes.push(p);
  }
  const dist=nodes.map(()=>Infinity), prev=[], seen=new Set(); dist[0]=0;
  for(let t=0;t<nodes.length;t++) {
    let u=-1; for(let i=0;i<nodes.length;i++) if(!seen.has(i)&&(u<0||dist[i]<dist[u]))u=i;
    if(u<0||!isFinite(dist[u]))return [];
    if(u===1)break; seen.add(u);
    for(let v=0;v<nodes.length;v++) if(v!==u&&!seen.has(v)&&lineClear(nodes[u],nodes[v])) {
      const d=dist[u]+Math.hypot(nodes[u].x-nodes[v].x,nodes[u].y-nodes[v].y);
      if(d<dist[v]) {dist[v]=d;prev[v]=u;}
    }
  }
  const out=[]; for(let v=1;v!==0;v=prev[v]) {if(v===undefined)return [];out.unshift(nodes[v]);}
  return out;
}

export class BreadHunt {
  constructor({city='Chennai',total=0,onCollect=()=>{},onFinish=()=>{}}={}) {
    this.city=city;this.total=total;this.onCollect=onCollect;this.onFinish=onFinish;
    this.phase='intro';this.collected=0;this.player={x:800,y:840,facing:1,action:0};
    this.bread=[];this.path=[];this.elapsed=0;
  }
  start() {
    this.collected=0;this.elapsed=0;this.phase='playing';this.path=[];
    Object.assign(this.player,{x:800,y:840,facing:1,action:0});
    this.bread=BREAD_SPOTS.map(([x,y],i)=>({id:i,x,y,active:true}));
  }
  target(x,y) {if(this.phase==='playing')this.path=routeTo(this.player,{x,y});}
  update(dt,input={x:0,y:0}) {
    if(this.phase!=='playing')return;
    this.elapsed+=dt;
    const p=this.player; let vx=input.x,vy=input.y;
    if(vx||vy)this.path=[];
    else if(this.path.length) {
      const t=this.path[0],dx=t.x-p.x,dy=t.y-p.y,l=Math.hypot(dx,dy);
      if(l<=WALK_SPEED*dt+2) {p.x=t.x;p.y=t.y;this.path.shift();}
      else {vx=dx/l;vy=dy/l;}
    }
    const l=Math.hypot(vx,vy);
    if(l) {
      const nx=p.x+vx/l*WALK_SPEED*dt,ny=p.y+vy/l*WALK_SPEED*dt;
      if(walkable(nx,ny)){p.x=nx;p.y=ny;}
      else if(walkable(nx,p.y))p.x=nx;
      else if(walkable(p.x,ny))p.y=ny;
      p.action=1;if(vx)p.facing=vx<0?-1:1;
    } else p.action=0;
    for(const b of this.bread) if(b.active&&Math.hypot(p.x-b.x,(p.y-b.y)*1.3)<39) {
      b.active=false;this.collected++;this.total+=10;this.onCollect({bread:b,points:10,total:this.total,city:this.city});
    }
    if(this.collected===12) {this.phase='finished';p.action=3;this.onFinish({score:120,total:this.total,elapsed:this.elapsed});}
  }
}
