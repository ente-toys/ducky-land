import {Application,Assets,Sprite,Container} from '/node_modules/pixi.js/dist/pixi.mjs';
import {animateCentre} from './animate.mjs';
import {geometry} from '/assets/world/island-geometry.mjs';
const theme=new URLSearchParams(location.search).get('theme') || (location.pathname.includes('/goldmine/')?'goldmine':'waterfall');
if(!['waterfall','goldmine'].includes(theme))throw Error('Unknown centre');
const folder=`/pixi-art/themes/${theme}/centre/`;
const data=await fetch(folder+'centre.json').then(r=>r.json());
const geo=geometry({coast:[[-2000,-2000],[2000,-2000],[2000,1700],[-2000,1700]],water:data.water.map(s=>s.ellipse??s),obstacles:data.blocked.map(s=>s.ellipse??s),islets:[],walkways:[],bridges:[]});
const app=new Application();await app.init({width:1600,height:1500,resolution:1,background:'#89C332',antialias:true,preserveDrawingBuffer:true});document.body.append(app.canvas);
const root=new Container();root.sortableChildren=true;app.stage.addChild(root);
const bounds=[Math.min(...data.pieces.map(p=>p.x))-80,Math.min(...data.pieces.map(p=>p.y))-100,Math.max(...data.pieces.map(p=>p.x+p.width))+80,Math.max(...data.pieces.map(p=>p.y+p.height))+80];
const scale=Math.min(1520/(bounds[2]-bounds[0]),1380/(bounds[3]-bounds[1]));root.scale.set(scale);root.position.set(800-(bounds[0]+bounds[2])/2*scale,780-(bounds[1]+bounds[3])/2*scale);
const records=[];
for(const [i,p]of data.pieces.entries()){
 const sprite=new Sprite(await Assets.load(folder+p.file));sprite.position.set(p.x,p.y);sprite.width=p.width;sprite.height=p.height;
 sprite.zIndex=p.layer==='decal'?-100000+i:p.layer==='back'?-50000+i:(p.sortY??p.at[1])+i*.0001;
 root.addChild(sprite);records.push({piece:p,sprite});
}
function inside(x,y,s){if(s.ellipse){const e=s.ellipse;return ((x-e.x)/e.rx)**2+((y-e.y)/e.ry)**2<1;}if(!s.poly)return false;let yes=false;for(let i=0,j=s.poly.length-1;i<s.poly.length;j=i++){const [a,b]=s.poly[i],[c,d]=s.poly[j];if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;}
let seed=39;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const duck=await Assets.load('/pixi-art/themes/waterfall/centre/ducky-scale.svg'),points=[];
for(let tries=0;points.length<100 && tries<100000;tries++){
 const x=(rnd()*2-1)*1060,y=(rnd()*2-1)*790;
 if(!data.walkable.some(s=>inside(x,y,s))||!geo.walkable(x,y)||points.some(q=>Math.hypot(x-q[0],(y-q[1])/.766)<95))continue;
 points.push([x,y]);const s=new Sprite(duck);s.anchor.set(.5,1);s.height=130;s.scale.x=Math.abs(s.scale.y)*(rnd()<.5?-1:1);s.position.set(x,y);s.zIndex=y;root.addChild(s);
}
let t=0;const reduce=matchMedia('(prefers-reduced-motion: reduce)');
app.ticker.add(ticker=>{t+=ticker.deltaMS/1000;animateCentre(records,t,reduce.matches);});
window.centrePreview={data,records,root,app,duckCount:points.length,setTime(seconds){app.ticker.stop();animateCentre(records,seconds,reduce.matches);app.render();},ready:true};
document.getElementById('caption').textContent=`${data.name} · ${points.length} Duckies · locked centre`;
