import {contours} from './tessellate.mjs';
// Ground-specific SVG compiler, adapted from ../globe-svg/compile.mjs.
// Unlike globe thumbnails, ground must retain fine strokes, patterns and exact colours.
import {Path2D,PathOp,FillType} from '@napi-rs/canvas';
const largePathCache=new Map();
function simplifyPath(path){
 const text=path.toSVGString();if(text.length<10000)return path.simplify();
 let simplified=largePathCache.get(text);if(!simplified){simplified=path.simplify();if(largePathCache.size>256)largePathCache.clear();largePathCache.set(text,new Path2D(simplified));}
 return new Path2D(simplified);
}
export const I=[1,0,0,1,0,0];
export const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function transform(text){let m=I;for(const [,kind,args]of text.matchAll(/(translate|scale|rotate|matrix|skewX|skewY)\(([^)]*)\)/g)){const v=args.trim().split(/[ ,]+/).map(Number);let n;if(kind==='translate')n=[1,0,0,1,v[0],v[1]??0];if(kind==='scale')n=[v[0],0,0,v[1]??v[0],0,0];if(kind==='matrix')n=v;if(kind==='rotate'){const a=v[0]*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=v[1]??0,y=v[2]??0;n=[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}if(kind==='skewX')n=[1,0,Math.tan(v[0]*Math.PI/180),1,0,0];if(kind==='skewY')n=[1,Math.tan(v[0]*Math.PI/180),0,1,0,0];m=mul(m,n);}return m;}
const transformed=(p,m)=>new Path2D(p).transform({a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]});
const elements=n=>Array.from(n.childNodes??[]).filter(n=>n.nodeType===1);
const declarations=s=>Object.fromEntries(s.split(';').map(p=>p.split(/:(.*)/s).slice(0,2).map(p=>p.trim())).filter(p=>p.length===2));
const inherited=['fill','stroke','stroke-width','fill-opacity','stroke-opacity','fill-rule','clip-rule','stroke-linejoin','stroke-linecap','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','color','visibility'];
function matches(n,selector){
 if(selector.includes(' ')){const parts=selector.trim().split(/\s+/),last=parts.pop();if(!matches(n,last))return false;let p=n.parentNode;while(p?.nodeType===1){if(matches(p,parts.join(' ')))return true;p=p.parentNode;}return false;}
 const id=selector.match(/#([\w-]+)/)?.[1],cls=[...selector.matchAll(/\.([\w-]+)/g)].map(m=>m[1]),tag=selector.match(/^[\w-]+/)?.[0];
 return (!id||n.getAttribute('id')===id)&&(!tag||tag===n.localName)&&cls.every(c=>n.getAttribute('class').split(/\s+/).includes(c));
}
function shape(n){const p=new Path2D(),v=k=>parseFloat(n.getAttribute(k)||0),tag=n.localName;
 if(tag==='path')return new Path2D(n.getAttribute('d'));
 if(tag==='rect'){const x=v('x'),y=v('y'),w=v('width'),h=v('height'),rx=v('rx')||v('ry'),ry=v('ry')||v('rx');if(w<=0||h<=0)return p;if(rx)p.roundRect(x,y,w,h,[Math.min(rx,w/2),Math.min(ry,h/2)]);else p.rect(x,y,w,h);return p;}
 if(tag==='circle'||tag==='ellipse'){const rx=tag==='circle'?v('r'):v('rx'),ry=tag==='circle'?v('r'):v('ry');if(rx>0&&ry>0)p.ellipse(v('cx'),v('cy'),rx,ry,0,0,Math.PI*2);return p;}
 if(tag==='line'){p.moveTo(v('x1'),v('y1'));p.lineTo(v('x2'),v('y2'));return p;}
 if(tag==='polygon'||tag==='polyline'){const a=(n.getAttribute('points').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)??[]).map(Number);if(a.length){p.moveTo(a[0],a[1]);for(let i=2;i<a.length;i+=2)p.lineTo(a[i],a[i+1]);if(tag==='polygon')p.closePath();}return p;}
 return null;
}
function intersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
function reduceLinear(p,m){const d=p.toSVGString();if(d.length<4000||/[CQ]/.test(d))return p;const scale=Math.max(Math.hypot(m[0],m[1]),Math.hypot(m[2],m[3])),t=.015/Math.max(.000001,scale);let result='';for(const part of d.match(/M[^M]+/g)??[]){const values=(part.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)??[]).map(Number),points=[];for(let i=0;i<values.length;i+=2)points.push([values[i],values[i+1]]);if(!points.length)continue;result+='M'+rdp(points,t).map(p=>p.map(n=>Math.round(n*1000)/1000).join(' ')).join('L')+(part.includes('Z')?'Z':'');}return result?new Path2D(result):p;}
export function rectClip(rects){const p=new Path2D();for(const r of rects)p.rect(...r);return rects.length>1?p.simplify().asWinding():p;}
export function crop(records,rects){const clip=rectClip(rects),cb=clip.computeTightBounds(),out=[];for(const r of records){const b=r.path.computeTightBounds();if(!intersects(b,cb))continue;const contained=rects.some(([x,y,w,h])=>b[0]>=x&&b[1]>=y&&b[2]<=x+w&&b[3]<=y+h);const path=contained?r.path:new Path2D(r.path).op(clip,PathOp.Intersect).asWinding();const bounds=path.computeTightBounds();if(Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1])>.1)out.push({...r,path});}return out;}

function dashPath(path,pattern,offset){
 if(pattern.some(v=>v<0)||!pattern.some(v=>v>0))throw Error('Invalid ground dash sequence');
 const sum=pattern.reduce((a,b)=>a+b,0),out=new Path2D();
 for(const points of contours(path,.03,true)){
  let k=0,left=((offset%sum)+sum)%sum;while(left>=pattern[k]){left-=pattern[k];k=(k+1)%pattern.length;}left=pattern[k]-left;let pen=false;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);let along=0;
   while(along<length){const step=Math.min(left,length-along),start=along/length,end=(along+step)/length;
    if(k%2===0){if(!pen)out.moveTo(a[0]+(b[0]-a[0])*start,a[1]+(b[1]-a[1])*start);out.lineTo(a[0]+(b[0]-a[0])*end,a[1]+(b[1]-a[1])*end);pen=true;}else pen=false;
    along+=step;left-=step;if(left<1e-9){k=(k+1)%pattern.length;left=pattern[k];if(k%2)pen=false;}
   }
  }
 }
 return out;
}

// Restrict stroke centreline segments before Skia outlines them. Very wide
// strokes on the 250 KB Pagepond lawn otherwise create millions of off-tile
// self intersections. End caps lie outside an expanded crop and cannot show.
function localStroke(path,m,clip,width){
 if(!clip)return new Path2D(path);
 const det=m[0]*m[3]-m[1]*m[2];if(!det)return new Path2D();
 const b=clip.computeTightBounds(),corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(([x,y])=>[(m[3]*(x-m[4])-m[2]*(y-m[5]))/det,(-m[1]*(x-m[4])+m[0]*(y-m[5]))/det]);
 const pad=width*4+1,box=[Math.min(...corners.map(p=>p[0]))-pad,Math.min(...corners.map(p=>p[1]))-pad,Math.max(...corners.map(p=>p[0]))+pad,Math.max(...corners.map(p=>p[1]))+pad];
 const originalBounds=path.computeTightBounds();if(originalBounds[0]>=box[0]&&originalBounds[1]>=box[1]&&originalBounds[2]<=box[2]&&originalBounds[3]<=box[3])return new Path2D(path);
 let text='';
 for(const part of path.toSVGString().match(/M[^M]*/g)??[]){
  const tokens=part.match(/[MLCQZ][^MLCQZ]*/g)??[],first=(tokens[0].slice(1).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)??[]).map(Number),segments=[];let at=first,closed=false;
  for(const token of tokens.slice(1)){const tag=token[0],values=tag==='Z'?first:(token.slice(1).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)??[]).map(Number),points=[at,...Array.from({length:values.length/2},(_,i)=>values.slice(i*2,i*2+2))],bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];segments.push({start:at,text:tag==='Z'?'L'+first.join(' '):token,keep:intersects(bounds,box)});at=values.slice(-2);closed||=tag==='Z';}
  const omitted=segments.findIndex(segment=>!segment.keep);
  if(omitted<0){text+=part;continue;}
  // Start a closed contour outside the retained region so its original M is
  // an ordinary joined vertex, rather than two butt-capped fragments.
  const ordered=closed?segments.slice(omitted+1).concat(segments.slice(0,omitted+1)):segments;let active=false;
  for(const segment of ordered){if(segment.keep){if(!active)text+='M'+segment.start.join(' ');text+=segment.text;active=true;}else active=false;}
 }

 return new Path2D(text);
}

export function compile(root,{matrix=I,clip=null,minSize=0,minStroke=0}={}){
 const scopes=new WeakMap(),owners=new WeakMap(),clipCache=new Map(),records=[],clipIndexes=new WeakMap();
 function clipRelation(path,b){let index=clipIndexes.get(path);if(!index){const grid=new Map(),parts=path.toSVGString().match(/[MLCQZ][^MLCQZ]*/g)??[];let at=[0,0],first=at;const add=(xs,ys)=>{const box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];for(let y=Math.floor(box[1]/16);y<=Math.floor(box[3]/16);y++)for(let x=Math.floor(box[0]/16);x<=Math.floor(box[2]/16);x++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(box);}};for(const part of parts){const v=(part.slice(1).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)??[]).map(Number),end=v.slice(-2);if(part[0]==='M'){at=end;first=end;continue;}if(part[0]==='Z'){add([at[0],first[0]],[at[1],first[1]]);at=first;continue;}const points=[at,...Array.from({length:v.length/2},(_,i)=>v.slice(i*2,i*2+2))];add(points.map(p=>p[0]),points.map(p=>p[1]));at=end;}index={grid};clipIndexes.set(path,index);}
  if((b[2]-b[0])*(b[3]-b[1])>20000)return 0;
  for(let y=Math.floor((b[1]-.1)/16);y<=Math.floor((b[3]+.1)/16);y++)for(let x=Math.floor((b[0]-.1)/16);x<=Math.floor((b[2]+.1)/16);x++)if((index.grid.get(x+','+y)??[]).some(edge=>intersects(edge,b)))return 0;
  return path.isPointInPath((b[0]+b[2])/2,(b[1]+b[3])/2)?1:-1;
 }
 let scopeIndex=0;
 function scope(svg,parent){const s={ids:new Map(),rules:[],parent,index:scopeIndex++};scopes.set(svg,s);function scan(n){owners.set(n,s);if(n!==svg&&n.localName==='svg'){scope(n,s);return;}if(n.hasAttribute('id'))s.ids.set(n.getAttribute('id'),n);if(n.localName==='style')for(const [,selectors,body]of n.textContent.matchAll(/([^{}]+)\{([^{}]*)\}/g))for(const selector of selectors.split(','))s.rules.push({selector:selector.trim(),paint:declarations(body),specificity:(selector.match(/#/g)?.length??0)*100+(selector.match(/\./g)?.length??0)*10});elements(n).forEach(scan);}scan(svg);s.rules.sort((a,b)=>a.specificity-b.specificity);return s;}
 scope(root,null);
 const lookup=(n,id)=>{let s=owners.get(n);while(s){if(s.ids.has(id))return s.ids.get(id);s=s.parent;}return null;};
 function paint(n,parent){const out=Object.fromEntries(inherited.filter(k=>parent[k]!=null).map(k=>[k,parent[k]]));for(const k of [...inherited,'opacity','display','clip-path','mask'])if(n.hasAttribute(k))out[k]=n.getAttribute(k);for(const rule of owners.get(n)?.rules??[])if(matches(n,rule.selector))Object.assign(out,rule.paint);Object.assign(out,declarations(n.getAttribute('style')));return out;}
 const ref=(n,value)=>{const id=value?.match(/^url\(['"]?#([^)'" ]+)['"]?\)$/)?.[1];if(!id)return null;const target=lookup(n,id);if(!target)throw Error(`Unresolved SVG paint reference #${id}`);return target;};
 function colour(n,value){if(!value||value==='none')return null;if(value==='currentColor')throw Error('Unresolved currentColor');const target=ref(n,value);if(target){
  if(target.localName==='pattern'){
   const w=parseFloat(target.getAttribute('width')),h=parseFloat(target.getAttribute('height')),x=parseFloat(target.getAttribute('x')||0),y=parseFloat(target.getAttribute('y')||0);
   for(const child of elements(target)){const style=paint(child,{fill:'black'}),p=shape(child);if(!p||style.fill==='none'||style.fill?.startsWith('url(')||parseFloat(style.opacity??1)<.99||parseFloat(style['fill-opacity']??1)<.99)continue;const b=p.computeTightBounds();if(b[0]<=x&&b[1]<=y&&b[2]>=x+w&&b[3]>=y+h&&p.isPointInPath(x+w*.1,y+h*.1)&&p.isPointInPath(x+w*.9,y+h*.9))return style.fill??'black';}
   return null;
  }
  if(!/Gradient$/.test(target.localName))throw Error(`Unsupported paint ${target.localName}`);const stops=Array.from(target.getElementsByTagName('stop')),stop=stops[Math.floor((stops.length-1)/2)];return stop?.getAttribute('stop-color')||declarations(stop?.getAttribute('style')??'')['stop-color']||'#e4c567';}return value;}
 function geometry(n,m,style,depth=0){if(depth>30)throw Error('Recursive SVG geometry');const s=paint(n,style),ctm=mul(m,transform(n.getAttribute('transform'))),out=new Path2D();
  if(n.localName==='use'){const href=n.getAttribute('href')||n.getAttribute('xlink:href'),target=lookup(n,href.slice(1));if(!target)throw Error(`Unresolved SVG instance ${href}`);return geometry(target,mul(ctm,[1,0,0,1,+(n.getAttribute('x')||0),+(n.getAttribute('y')||0)]),s,depth+1);}
  let p=shape(n);if(p){p=reduceLinear(p,ctm);if((s['clip-rule']||s['fill-rule'])==='evenodd')p.setFillType(FillType.EvenOdd);out.addPath(transformed(p,ctm).asWinding());}else for(const c of elements(n))out.op(geometry(c,ctm,s,depth+1),PathOp.Union);return out;
 }
 function clipping(n,value,m,style,isMask=false){const target=ref(n,value);if(!target)return null;const key=owners.get(target).index+'|'+value+'|'+m.join(',')+'|'+(isMask?'mask':'clip');if(clipCache.has(key))return clipCache.get(key);let p;
  if(!isMask)p=geometry(target,m,style);
  else {p=new Path2D();for(const c of elements(target)){const s=paint(c,{fill:'black',...style}),g=geometry(c,m,s),fill=(s.fill??'black').toLowerCase();p.op(g,['black','#000','#000000'].includes(fill)?PathOp.Difference:PathOp.Union);}}
  clipCache.set(key,p);return p;
 }
 function emit(n,p,m,fill,opacity,activeClip,clipStack,stroke=null){
  if(!fill||opacity<=0)return;let path=transformed(p,m).asWinding();if(stroke){stroke.sourcePath=new Path2D(path);stroke.sourceClip=activeClip;}let b=path.computeTightBounds();if(!b.every(Number.isFinite))return;const fallback=[];
  for(const clip of clipStack){const cb=clip.computeTightBounds();if(!intersects(b,cb))return;if(clipRelation(clip,b)===1)continue;
   const before=path.toSVGString();const clipped=simplifyPath(path).op(clip,PathOp.Intersect),next=clipped.computeTightBounds();
   // PathOp leaves the input unchanged on some dense, invalid legacy paths.
   if(clipped.toSVGString()===before||next[0]<cb[0]-.01||next[1]<cb[1]-.01||next[2]>cb[2]+.01||next[3]>cb[3]+.01)fallback.push(clip);
   else {path=clipped;b=next;}
  }
  records.push({path,fill,opacity,clips:fallback,...(stroke?{stroke}: {})});
 }
 function walk(n,m,parent,alpha,activeClip,depth=0,isRoot=false,activeClips=[]){if(depth>40)throw Error('Recursive SVG instance');const tag=n.localName;if(['defs','style','title','desc','metadata','linearGradient','radialGradient','clipPath','mask','pattern','text'].includes(tag))return;
  const s=paint(n,parent);if(s.display==='none'||s.visibility==='hidden')return;let ctm=mul(m,transform(n.getAttribute('transform'))),opacity=alpha*parseFloat(s.opacity??1),localClip=activeClip,clipStack=[...activeClips];
  if(tag==='svg'&&!isRoot){const vb=(n.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number),x=+(n.getAttribute('x')||0),y=+(n.getAttribute('y')||0),w=+(n.getAttribute('width')||vb[2]),h=+(n.getAttribute('height')||vb[3]);if(vb.length===4&&w&&h){const frame=transformed(rectClip([[x,y,w,h]]),ctm);clipStack.push(frame);localClip=localClip?new Path2D(localClip).op(frame,PathOp.Intersect):frame;ctm=mul(ctm,[w/vb[2],0,0,h/vb[3],x-vb[0]*w/vb[2],y-vb[1]*h/vb[3]]);}}
  for(const [key,isMask]of [['clip-path',false],['mask',true]])if(s[key]&&s[key]!=='none'){const p=clipping(n,s[key],ctm,s,isMask);if(p){clipStack.push(p);localClip=localClip?new Path2D(localClip).op(p,PathOp.Intersect):p;}}
  if(tag==='use'){const href=n.getAttribute('href')||n.getAttribute('xlink:href');if(!href?.startsWith('#'))throw Error('External SVG instance');const target=lookup(n,href.slice(1));if(!target)throw Error(`Unresolved SVG instance ${href}`);walk(target,mul(ctm,[1,0,0,1,+(n.getAttribute('x')||0),+(n.getAttribute('y')||0)]),s,opacity,localClip,depth+1,false,clipStack);return;}
  let p=shape(n);
  if(p){p=reduceLinear(p,ctm);if(s['fill-rule']==='evenodd')p.setFillType(FillType.EvenOdd);let fill=s.fill??'black';if(fill==='currentColor')fill=s.color??'black';const server=ref(n,fill);
   if(server?.localName==='pattern'){
    if(server.getAttribute('patternUnits')!=='userSpaceOnUse'||server.hasAttribute('patternTransform'))throw Error('Unsupported ground pattern units/transform');
    const region=transformed(p,ctm).asWinding();if(localClip)region.op(localClip,PathOp.Intersect);
    const bounds=p.computeTightBounds(),w=+server.getAttribute('width'),h=+server.getAttribute('height'),ox=+(server.getAttribute('x')||0),oy=+(server.getAttribute('y')||0);
    if(!(w>0&&h>0))throw Error('Invalid ground pattern');
    for(let y=Math.floor((bounds[1]-oy)/h);y<Math.ceil((bounds[3]-oy)/h);y++)for(let x=Math.floor((bounds[0]-ox)/w);x<Math.ceil((bounds[2]-ox)/w);x++){
     const pm=mul(ctm,[1,0,0,1,ox+x*w,oy+y*h]);const cell=transformed(rectClip([[0,0,w,h]]),pm).op(region,PathOp.Intersect);
     for(const child of elements(server))walk(child,pm,{},opacity*parseFloat(s['fill-opacity']??1),cell,depth+1,false,[...clipStack,region,cell]);
    }
   }else emit(n,p,ctm,colour(n,fill),opacity*parseFloat(s['fill-opacity']??1),localClip,clipStack);
   const stroke=s.stroke==='currentColor'?(s.color??'black'):s.stroke,width=parseFloat(s['stroke-width']??1),scale=Math.max(Math.hypot(ctm[0],ctm[1]),Math.hypot(ctm[2],ctm[3]));
   if(stroke&&stroke!=='none'&&width*scale>=minStroke){const cap={butt:0,round:1,square:2}[s['stroke-linecap']]??0,join={miter:0,round:1,bevel:2}[s['stroke-linejoin']]??0;let outline=new Path2D(p);if(s['stroke-dasharray']&&s['stroke-dasharray']!=='none'){const dash=s['stroke-dasharray'].trim().split(/[ ,]+/).map(Number);if(dash.length%2)dash.push(...dash);outline=dashPath(outline,dash,+(s['stroke-dashoffset']||0));}outline=localStroke(outline,ctm,localClip,width);emit(n,outline.stroke({width,cap,join,miterLimit:parseFloat(s['stroke-miterlimit']??4)}),ctm,colour(n,stroke),opacity*parseFloat(s['stroke-opacity']??1),localClip,clipStack,{width:width*scale,fill:colour(n,fill),sourceNode:n});}
  }else for(const c of elements(n))walk(c,ctm,s,opacity,localClip,depth+1,false,clipStack);
 }
 walk(root,matrix,{fill:'black',stroke:'none'},1,clip,0,true,clip?[clip]:[]);
 return records;
}

function rdp(p,t){if(p.length<3)return p;const keep=new Set([0,p.length-1]),stack=[[0,p.length-1]];while(stack.length){const [a,b]=stack.pop(),dx=p[b][0]-p[a][0],dy=p[b][1]-p[a][1],l=dx*dx+dy*dy;let d=t*t,k=-1;for(let i=a+1;i<b;i++){const u=l?Math.max(0,Math.min(1,((p[i][0]-p[a][0])*dx+(p[i][1]-p[a][1])*dy)/l)):0,v=(p[i][0]-p[a][0]-u*dx)**2+(p[i][1]-p[a][1]-u*dy)**2;if(v>d){d=v;k=i;}}if(k>=0){keep.add(k);stack.push([a,k],[k,b]);}}return p.filter((_,i)=>keep.has(i));}
