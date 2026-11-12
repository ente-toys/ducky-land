import {homePropContract} from './home-layer.js';
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
export function homeDecisionParts(p){
 const rule=homePropContract(p);
 if(rule?.decision==='A3'){
  const q={...p,height:360,y:p.y+120,groundShadowSrc:undefined};
  const part=(suffix,poly,ground=false)=>{
   const src=`/pixi-art/home-decisions/farm-${suffix}.svg`,w=q.width*q.scale,h=q.height*q.scale;
   const footprint=poly?{poly:poly.map(([u,v])=>[q.x+(u/700-q.anchor.x)*w,q.y+(v/360-q.anchor.y)*h])}:undefined;
   return {...q,id:p.id+':'+suffix,src,asset:'farm-'+suffix,name:'Farm '+suffix,footprint,sortFootY:footprint?Math.max(...footprint.poly.map(q=>q[1])):q.y,homeContract:{kind:'farm-'+suffix,decision:'A3',layer:ground?'ground':'upright',class:ground?'ground':'solid-block'},noShadow:true};
  };
  return [part('soil',null,true),part('fence-back',rect(32,70,668,88)),part('fence-left',rect(17,74,45,349)),part('fence-right',rect(667,74,695,349)),part('fence-front-left',rect(17,304,238,325)),part('fence-front-right',rect(462,304,683,325)),...[[56,226],[265,435],[474,644]].map(([x0,x1],i)=>part('bed-'+i,rect(x0,94,x1,180)))];
 }
 if(rule?.decision==='A4'){
  const w=p.width*p.scale,h=p.height*p.scale;
  const shape=poly=>({poly:poly.map(([u,v])=>[p.x+(u/236-p.anchor.x)*w,p.y+(v/264-p.anchor.y)*h])});
  const posts=[[20,30,219],[54,64,230],[173,183,230],[205,215,221]].map(([a,b,y])=>shape(rect(a,y-14,b,y)));
  const clean={...p,footprint:undefined,groundShadowSrc:undefined,noShadow:true};
  return [{...clean,src:'/pixi-art/home-decisions/bandstand-upright.svg',homeContract:{...rule,groundShadowSrc:undefined,uprightSrc:undefined},blockers:posts,sortFootY:Math.max(...posts.flatMap(s=>s.poly.map(q=>q[1])))},
   {...clean,id:p.id+':stage',src:'/pixi-art/home-decisions/bandstand-stage.svg',asset:'bandstand-stage',homeContract:{kind:'bandstand-stage',decision:'A4',layer:'ground',class:'deck'}}];
 }
 if(rule?.decision==='A2'&&rule.kind==='crop-tomato-trellis'){
  const w=p.width*p.scale,h=p.height*p.scale;
  const blockers=[[11,18,67],[52,59,79],[96,103,89]].map(([x0,x1,y])=>({poly:rect(x0,y-9,x1,y).map(([u,v])=>[p.x+(u/135-p.anchor.x)*w,p.y+(v/90-p.anchor.y)*h])}));
  return [{...p,footprint:undefined,blockers,sortFootY:Math.max(...blockers.flatMap(s=>s.poly.map(q=>q[1])))}];
 }
 return [p];
}
