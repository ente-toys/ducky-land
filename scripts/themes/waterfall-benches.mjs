// Use Home's exact slatted arc construction at each Waterfall ring's own radius.
import {readFileSync,writeFileSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/waterfall/',D='assets/world/themes/waterfall/';
const read=f=>JSON.parse(readFileSync(f)),art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),centre=read(A+'centre/centre.json');
const snap=read('scripts/themes/waterfall-ten-source.json');
const oldBlocks=snap.centre.blocked.filter(b=>b.name?.startsWith('bench-'));
const oldObstacle=o=>oldBlocks.some(b=>o.centre==='waterfall'&&Math.abs((o.x??-999)-(3900+b.ellipse.x*.48))<.1&&Math.abs((o.y??-999)-(3800+b.ellipse.y*.48))<.1);
world.obstacles=world.obstacles.filter(o=>!oldObstacle(o)&&!o.waterfallArc);
art.props=art.props.filter(p=>!p.id?.startsWith('waterfall-arc-')&&!/^centre\/bench-/.test(p.src));
centre.blocked=centre.blocked.filter(b=>!b.name?.startsWith('bench-'));
const records=[];
function bench(id,cx,cy,r,k,deg,span,local=false){
 const b={deg,span},sIn=r-20,sOut=r+20,back=r+24,ground=(angle,s)=>{let t=angle*Math.PI/180;return [cx+s*Math.cos(t),cy+s*k*Math.sin(t)]};
 const opts={ground,sIn,sOut,back,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5};
 const points=s=>Array.from({length:33},(_,i)=>ground(deg-span/2+span*i/32,s));
 const footprint=[...points(sIn-4),...points(back+4).reverse()];
 const all=[...points(sIn-4),...points(back+5)];
 const x0=Math.floor(Math.min(...all.map(p=>p[0])))-5,x1=Math.ceil(Math.max(...all.map(p=>p[0])))+5;
 const y0=Math.floor(Math.min(...all.map(p=>p[1])))-54,y1=Math.ceil(Math.max(...all.map(p=>p[1])))+5;
 const [x,y]=ground(deg,r),width=x1-x0,height=y1-y0;
 const file=local?`centre/${id}.svg`:`waterfall-arc-${id}.svg`;
 writeFileSync(A+file,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}" stroke-linecap="round" stroke-linejoin="round"><title>Home slatted arc bench following the Waterfall ${local?'viewing circle':'lawn'} ring</title>${drawArcBench(b,opts).join('')}</svg>`);
 const p={id:`waterfall-arc-${id}`,name:'Curved ring bench',src:file,x,y,width,height,scale:1,anchor:{x:(x-x0)/width,y:(y-y0)/height},shadow:false,wind:false};
 const block={poly:footprint,waterfallArc:id};
 if(local){
  // SVG is in world-size units; metadata stays centre-local for future integration.
  const piece={id,file:`${id}.svg`,layer:'sorted',x:(x0-3900)/.48,y:(y0-3800)/.48,width:width/.48,height:height/.48,anchor:{x:0,y:0},at:[(x0-3900)/.48,(y0-3800)/.48],sortY:(y-3800)/.48};
  // Use a local viewBox as centre pieces must remain independently reusable.
  const raw=readFileSync(A+file,'utf8').replace(`viewBox="${x0} ${y0} ${width} ${height}"`,`viewBox="${piece.x} ${piece.y} ${piece.width} ${piece.height}"`).replace('</title>','</title><g transform="scale(2.0833333333333335) translate(-3900 -3800)">').replace('</svg>','</g></svg>');
  writeFileSync(A+file,raw);p.centrePiece=piece;p.id=`integrated-centre-${id}`;p.name=`Centre ${id}`;
  centre.pieces=centre.pieces.map(q=>q.id===id?piece:q);
  centre.blocked.push({name:id,poly:footprint.map(([xx,yy])=>[(xx-3900)/.48,(yy-3800)/.48])});block.centre='waterfall';
 }
 art.props.push(p);world.obstacles.push(block);records.push({id,cx,cy,r,k,deg,span,footprint});
}
[-111,-69,145,35].forEach((deg,i)=>bench(`bench-${i}`,3900,3800,477,.7659574468,deg,24,true));
// Rear halves of activity lawns, outside the free field and away from entrances.
bench('fern-west',1730,2600,644,495/644,-112,20);
bench('fern-east',1730,2600,644,495/644,-68,20);
bench('lagoon-west',6100,2600,644,495/644,-112,20);
bench('lagoon-east',6100,2600,644,495/644,-68,20);
// The shallow south green gets the same construction, fitted to its own rim.
bench('picnic-west',3900,4630,660,290/660,-125,16);
bench('picnic-east',3900,4630,660,290/660,-55,16);
world.props=art.props;walk.obstacles=world.obstacles;
for(const [file,data]of [[A+'art.json',art],[D+'world.json',world],[D+'walk-world.json',walk],[A+'centre/centre.json',centre],[A+'waterfall-arcs.json',records]])writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log(records.length,'curved benches, shared Home geometry; matching collision polygons');
