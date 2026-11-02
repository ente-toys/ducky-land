export const CITIES=['Kochi','Chennai','Bengaluru','London'];
const NAMES=['you','mo','pip','nori','miso','aya','sunny','lulu'];
export class DuckRace {
  constructor({count=8,city=1,onCountdown=()=>{},onFinish=()=>{}}={}) {
    this.count=Math.max(2,Math.min(8,Math.floor(Number(count)||8)));this.city=city;
    this.onCountdown=onCountdown;this.onFinish=onFinish;this.phase='intro';this.elapsed=0;
    this.racers=[];this.finishOrder=[];this.taps=0;this.lastTap=-1;
    this.resetRacers();
  }
  resetRacers() {
    this.racers=Array.from({length:this.count},(_,i)=>({id:i,name:NAMES[i],isPlayer:i===0?1:0,city:i?i%4:this.city,
      cap:i?1+i:8,shades:i%3===0?1:0,progress:0,velocity:0,finished:false,finishTime:null,
      aiSpeed:.033+(i*.00117),paddleUntil:0,x:0,y:0,facing:1,action:0}));
    this.positions();
  }
  start() {
    this.resetRacers();this.finishOrder=[];this.elapsed=0;this.countdown=3;this.phase='countdown';
    this.taps=0;this.lastTap=-1;this.onCountdown();
  }
  paddle() {
    if(this.phase!=='racing'||this.racers[0].finished||this.elapsed-this.lastTap<.085)return false;
    this.lastTap=this.elapsed;this.taps++;
    const p=this.racers[0];p.velocity=Math.min(.087,p.velocity+.022);p.paddleUntil=this.elapsed+.25;
    return true;
  }
  update(dt) {
    if(this.phase==='countdown') {
      this.countdown-=dt;
      if(this.countdown<=0){this.phase='racing';this.elapsed=0;}
      return;
    }
    if(this.phase!=='racing')return;
    const before=this.elapsed;this.elapsed+=dt;
    const crossed=[];
    for(const r of this.racers) {
      if(r.finished)continue;
      let speed;
      if(r.id===0) {
        r.velocity*=Math.exp(-2.3*dt);speed=.008+r.velocity;
        r.action=this.elapsed<r.paddleUntil?1:0;
      } else {
        speed=r.aiSpeed*(1+.09*Math.sin(this.elapsed*1.8+r.id*2.3));r.action=1;
        r.paddleUntil=this.elapsed+.2;
      }
      const previous=r.progress;r.progress+=speed*dt;
      if(r.progress>=1) {
        r.progress=1;r.finished=true;r.action=3;
        r.finishTime=before+(1-previous)/speed;crossed.push(r);
      }
    }
    crossed.sort((a,b)=>a.finishTime-b.finishTime||a.id-b.id);
    this.finishOrder.push(...crossed);
    this.positions();
    if(this.finishOrder.length===this.count) {
      this.phase='finished';this.onFinish({order:[...this.finishOrder],taps:this.taps});
    }
  }
  positions() {
    for(const r of this.racers) {
      // Spread the grid along the start line, then carry that offset around
      // the oval tangent. This keeps all eight floats visible at the start.
      const middle=Math.floor((this.count-1)/2);
      const lane=middle+(r.id%2?Math.ceil(r.id/2):-r.id/2);
      const offset=(lane-(this.count-1)/2)*112,a=r.progress*Math.PI*2;
      r.x=800+Math.sin(a)*460+Math.cos(a)*offset;
      r.y=560+Math.cos(a)*260-Math.sin(a)*offset*.5;
      r.facing=460*Math.cos(a)-Math.sin(a)*offset>=0?1:-1;
    }
  }
}
