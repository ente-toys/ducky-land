import {readFileSync,writeFileSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/canal/',D='assets/world/themes/canal/';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
const old=art.props.filter(p=>/^integrated-centre-bench-/.test(p.id));
world.obstacles=world.obstacles.filter(o=>{
 if(o.canalTenBench||o.canalTenPlanter)return false;
 if(!o.centre||!o.poly)return true;
 const x=o.poly.reduce((s,p)=>s+p[0],0)/o.poly.length,y=o.poly.reduce((s,p)=>s+p[1],0)/o.poly.length;
 return !old.some(p=>Math.abs(x-p.x)<80&&Math.abs(y-p.y)<70);
});
art.props=art.props.filter(p=>!/^integrated-centre-bench-|^canal-ten-bench-|^canal-ten-planter-/.test(p.id));
const specs=[...[-145,-35,55,125].map(deg=>({deg,r:480,span:28})),...[-115,-65,90].map(deg=>({deg,r:830,span:17}))];
const metrics=[];
for(const [i,b]of specs.entries()){
 const dims={sIn:b.r-19,sOut:b.r+21,back:b.r+25,seat:17,top:47,u:1,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:3.2*422/b.r};
 const ground=(deg,r)=>{const a=deg*Math.PI/180;return [4000+Math.cos(a)*r,3320+Math.sin(a)*r*.766]};
 const pts=r=>Array.from({length:25},(_,n)=>ground(b.deg-b.span/2+n*b.span/24,r));
 const footprint=[...pts(dims.sIn-4),...pts(dims.back+4).reverse()].map(p=>p.map(v=>Math.round(v*100)/100));
 const bounds=[...pts(dims.sIn-4),...pts(dims.back+4)].flatMap(([x,y])=>[[x-5,y+5],[x+5,y-dims.top-5]]);
 const x0=Math.floor(Math.min(...bounds.map(p=>p[0]))),y0=Math.floor(Math.min(...bounds.map(p=>p[1])));
 const width=Math.ceil(Math.max(...bounds.map(p=>p[0])))-x0,height=Math.ceil(Math.max(...bounds.map(p=>p[1])))-y0;
 const [x,y]=ground(b.deg,b.r),src=`detail/canal-arc-bench-${i+1}.svg`;
 writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}"><title>Canal curved slatted bench, ${b.r} radius ring, ${b.deg} degrees</title><g stroke-linecap="round" stroke-linejoin="round">${drawArcBench(b,{...dims,ground}).join('')}</g></svg>`);
 art.props.push({id:`canal-ten-bench-${i+1}`,name:'Curved fountain ring bench',src,x,y,width,height,scale:1,anchor:{x:(x-x0)/width,y:(y-y0)/height},flip:false,wind:false,shadow:false});
 world.obstacles.push({poly:footprint,canalTenBench:true});
 metrics.push({id:`canal-ten-bench-${i+1}`,radius:b.r,deg:b.deg,span:b.span,footprint});
}
const template=art.props.find(p=>p.src==='reuse/street--planter-flowers.svg');
for(const [i,deg]of [-130,-50,50,130].entries()){
 const rad=deg*Math.PI/180,x=4000+Math.cos(rad)*590,y=3320+Math.sin(rad)*590*.766;
 art.props.push({...template,id:`canal-ten-planter-${i+1}`,name:'Fountain ring flower planter',x,y,scale:88/template.height,flip:false});
 world.obstacles.push({x,y:y-8,rx:35,ry:20,canalTenPlanter:true});
}
world.props=art.props;walk.obstacles=world.obstacles;
for(const[p,data]of [[A+'art.json',art],[D+'world.json',world],[D+'walk-world.json',walk]])writeFileSync(p,JSON.stringify(data));
writeFileSync(A+'arc-benches.json',JSON.stringify(metrics,null,2));
console.log(`${metrics.length} curved benches on two plaza rings; exact band collisions and ground anchors`);
