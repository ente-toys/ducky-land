// Home's actual curved seating construction, on the three Canal activity rings.
import {readFileSync,writeFileSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/canal/',D='rive/web/themes/canal/',rd=p=>JSON.parse(readFileSync(p));
const art=rd(A+'art.json'),world=rd(D+'world.json'),walk=rd(D+'walk-world.json');
art.props=art.props.filter(p=>!p.id.startsWith('canal-close-bench-'));world.obstacles=world.obstacles.filter(o=>!o.canalCloseBench);
const specs=rd(A+'close-bench-specs.json');
for(const [i,b]of specs.entries()){
 const ground=(deg,r)=>{const t=deg*Math.PI/180;return [b.cx+r*Math.cos(t),b.cy+r*b.ratio*Math.sin(t)]};
 const dims={sIn:b.r-19,sOut:b.r+21,back:b.r+25,seat:17,top:47,u:1,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:3.2*422/b.r};
 const bb=b.footprint.flatMap(([x,y])=>[[x-6,y-54],[x+6,y+7]]),x0=Math.floor(Math.min(...bb.map(p=>p[0]))),y0=Math.floor(Math.min(...bb.map(p=>p[1]))),width=Math.ceil(Math.max(...bb.map(p=>p[0])))-x0,height=Math.ceil(Math.max(...bb.map(p=>p[1])))-y0;
 const [x,y]=ground(b.deg,b.r),src=`detail/canal-close-bench-${i+1}.svg`;
 writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}"><g stroke-linecap="round" stroke-linejoin="round">${drawArcBench(b,{...dims,ground}).join('')}</g></svg>`);
 art.props.push({id:`canal-close-bench-${i+1}`,name:'Curved activity lawn bench',src,x,y,width,height,scale:1,anchor:{x:(x-x0)/width,y:(y-y0)/height},shadow:false,wind:false});world.obstacles.push({poly:b.footprint,canalCloseBench:true});
}
world.props=art.props;walk.obstacles=world.obstacles;
for(const[p,o]of [[A+'art.json',art],[D+'world.json',world],[D+'walk-world.json',walk]])writeFileSync(p,JSON.stringify(o));
console.log(`${specs.length} curved activity benches`);
