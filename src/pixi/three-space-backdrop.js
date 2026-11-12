import {Quaternion,transformMatrix,clamp} from './globe-math.js';
export const SPACE_LOOKS=Object.freeze({
  starlight:{name:'Quiet starlight',stars:240,shade:.20,star:'#E1EBF2',cross:3},
  storybook:{name:'Storybook orbit',stars:145,shade:.10,star:'#FFF0C7',cross:7},
  deepspace:{name:'Deep space',stars:620,shade:.46,star:'#CDDBF4',cross:4}
});

// Cached space layer. Star twinkle never forces the globe to redraw.
export function createSpaceBackdrop(host,initial='starlight'){
  const base=document.createElement('canvas'),fx=document.createElement('canvas');
  base.className='space-backdrop';fx.className='space-effects';base.setAttribute('aria-hidden','true');fx.setAttribute('aria-hidden','true');
  for(const c of [base,fx])Object.assign(c.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'});
  host.prepend(base,fx);
  const ctx=base.getContext('2d'),motion=fx.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let look=SPACE_LOOKS[initial]?initial:'starlight',width=1,height=1,dpr=1,raf=0,last=0,active=true,destroyed=false;
  const twinkles=[],field=[],previous=new Quaternion(),delta=new Quaternion(),rotation=new Float64Array(16), origin={x:0,y:0,z:0};
  const offset={x:0,y:0,roll:0};let hasRotation=false;
  const cross=(c,x,y,r,color,alpha=1)=>{
    c.save();c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();
    c.moveTo(x,y-r);c.quadraticCurveTo(x+r*.16,y-r*.16,x+r,y);c.quadraticCurveTo(x+r*.16,y+r*.16,x,y+r);c.quadraticCurveTo(x-r*.16,y+r*.16,x-r,y);c.quadraticCurveTo(x-r*.16,y-r*.16,x,y-r);c.fill();c.restore();
  };
  function paint(){
    const s=SPACE_LOOKS[look];ctx.clearRect(0,0,width,height);ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);twinkles.length=field.length=0;
    let seed=719;
    const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    const count=Math.round(s.stars*Math.max(.7,width*height/(1440*900)));
    for(let i=0;i<count;i++){
      const x=random()*width,y=random()*height,bright=random(),r=bright>.94?s.cross*(.6+random()*.4):.45+random()*.7;
      if(bright>.80&&twinkles.length<100){twinkles.push({x,y,r,depth:.55+random()*.35,phase:random()*6.28,speed:1.2+random()*1.4,cross:bright>.94});}
      else{field.push({x,y,r,depth:.18+random()*.14,alpha:.18+bright*bright*.72});}
    }
    ctx.globalAlpha=1;
    base.dataset.spaceStyle=look;base.dataset.starCount=String(count);base.dataset.background='#000000';
    fx.dataset.asteroids='0';fx.dataset.comets='0';fx.dataset.twinkleCount=String(twinkles.length);
    if(reduced){for(const star of field){ctx.globalAlpha=star.alpha;ctx.fillStyle=s.star;ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();}for(const star of twinkles)cross(ctx,star.x,star.y,star.r,s.star,.65);ctx.globalAlpha=1;}
  }
  const wrap=(n,size)=>((n%size)+size)%size;
  function point(star){
    const a=offset.roll*star.depth,c=Math.cos(a),s=Math.sin(a),x=star.x-width/2,y=star.y-height/2;
    return {x:wrap(width/2+c*x-s*y+offset.x*star.depth,width),y:wrap(height/2+s*x+c*y+offset.y*star.depth,height)};
  }
  function resize(){const b=host.getBoundingClientRect();width=b.width;height=b.height;dpr=Math.min(devicePixelRatio,1.5);for(const c of [base,fx]){c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}paint();}
  function tick(now){
    if(!active||destroyed||document.hidden||reduced)return;
    if(now-last>=1000/30-.5){last=now;motion.clearRect(0,0,width,height);const t=now/1000;
      for(const star of field){const p=point(star);motion.globalAlpha=star.alpha;motion.fillStyle=SPACE_LOOKS[look].star;motion.beginPath();motion.arc(p.x,p.y,star.r,0,Math.PI*2);motion.fill();}
      for(const star of twinkles){
        const wave=.5+.5*Math.sin(t*star.speed+star.phase),alpha=.10+.90*wave*wave,r=star.r*(.7+.4*wave);
        const p=point(star);
        if(star.cross)cross(motion,p.x,p.y,r,SPACE_LOOKS[look].star,alpha);
        else{motion.globalAlpha=alpha;motion.fillStyle=SPACE_LOOKS[look].star;motion.beginPath();motion.arc(p.x,p.y,r,0,Math.PI*2);motion.fill();}
      }
      motion.globalAlpha=1;fx.dataset.animationTick=String(now.toFixed(0));
    }
    raf=requestAnimationFrame(tick);
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
  const visibility=()=>{cancelAnimationFrame(raf);if(!document.hidden&&active&&!destroyed&&!reduced)raf=requestAnimationFrame(tick);};document.addEventListener('visibilitychange',visibility);
  if(!reduced)raf=requestAnimationFrame(tick);
  return {setStyle(id){look=SPACE_LOOKS[id]?id:'starlight';paint();},
    setRotation(q){
      if(!hasRotation){previous.copy(q);hasRotation=true;return;}
      if(!reduced){delta.copy(previous).invert().premultiply(q);transformMatrix(rotation,delta,origin);const y=Math.abs(rotation[9])<.9999999?Math.atan2(rotation[8],rotation[10]):Math.atan2(-rotation[2],rotation[0]);const roll=Math.abs(rotation[9])<.9999999?Math.atan2(rotation[1],rotation[5]):0;offset.x+=y*width*.06;offset.y-=Math.asin(clamp(-rotation[9],-1,1))*height*.06;offset.roll+=roll*.06;fx.dataset.parallaxX=offset.x.toFixed(2);fx.dataset.parallaxY=offset.y.toFixed(2);fx.dataset.parallaxLayers='2';}
      previous.copy(q);
    },
    setActive(value){if(active===value)return;active=value;cancelAnimationFrame(raf);if(value&&!reduced&&!document.hidden)raf=requestAnimationFrame(tick);else motion.clearRect(0,0,width,height);},
    destroy(){destroyed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();document.removeEventListener('visibilitychange',visibility);base.remove();fx.remove();}
  };
}
