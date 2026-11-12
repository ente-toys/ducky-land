import {Path2D,PathOp,FillType} from '@napi-rs/canvas';
export const I=[1,0,0,1,0,0];
export const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function transform(text){let m=I;for(const [,kind,args]of text.matchAll(/(translate|scale|rotate|matrix|skewX|skewY)\(([^)]*)\)/g)){const v=args.trim().split(/[ ,]+/).map(Number);let n;if(kind==='translate')n=[1,0,0,1,v[0],v[1]??0];if(kind==='scale')n=[v[0],0,0,v[1]??v[0],0,0];if(kind==='matrix')n=v;if(kind==='rotate'){const a=v[0]*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=v[1]??0,y=v[2]??0;n=[c,s,-s,c,x-c*x+s*y,y-s*x-c*y];}if(kind==='skewX')n=[1,0,Math.tan(v[0]*Math.PI/180),1,0,0];if(kind==='skewY')n=[1,Math.tan(v[0]*Math.PI/180),0,1,0,0];m=mul(m,n);}return m;}
const transformed=(p,m)=>new Path2D(p).transform({a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]});
const elements=n=>Array.from(n.childNodes??[]).filter(n=>n.nodeType===1);
const declarations=s=>Object.fromEntries(s.split(';').map(p=>p.split(/:(.*)/s).slice(0,2).map(p=>p.trim())).filter(p=>p.length===2));
const inherited=['fill','stroke','stroke-width','fill-opacity','stroke-opacity','fill-rule','clip-rule','stroke-linejoin','stroke-linecap','stroke-miterlimit','color','visibility'];
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
function reduceLinear(p,m){const d=p.toSVGString();if(d.length<4000||/[CQ]/.test(d))return p;const scale=Math.max(Math.hypot(m[0],m[1]),Math.hypot(m[2],m[3])),t=.1/Math.max(.000001,scale);let result='';for(const part of d.match(/M[^M]+/g)??[]){const values=(part.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)??[]).map(Number),points=[];for(let i=0;i<values.length;i+=2)points.push([values[i],values[i+1]]);if(!points.length)continue;result+='M'+rdp(points,t).map(p=>p.map(n=>Math.round(n*1000)/1000).join(' ')).join('L')+(part.includes('Z')?'Z':'');}return result?new Path2D(result):p;}
export function rectClip(rects){const p=new Path2D();for(const r of rects)p.rect(...r);return rects.length>1?p.simplify().asWinding():p;}
export function crop(records,rects){const clip=rectClip(rects),cb=clip.computeTightBounds(),out=[];for(const r of records){const b=r.path.computeTightBounds();if(!intersects(b,cb))continue;const contained=rects.some(([x,y,w,h])=>b[0]>=x&&b[1]>=y&&b[2]<=x+w&&b[3]<=y+h);const path=contained?r.path:new Path2D(r.path).op(clip,PathOp.Intersect).asWinding();const bounds=path.computeTightBounds();if(Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1])>.1)out.push({...r,path});}return out;}

export function compile(root,{matrix=I,clip=null,minSize=.35,minStroke=.35}={}){
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
 function emit(n,p,m,fill,opacity,activeClip){if(!fill||opacity<=.015)return;let path=transformed(p,m).asWinding(),b=path.computeTightBounds();if(!b.every(Number.isFinite)||Math.max(b[2]-b[0],b[3]-b[1])<minSize)return;if(activeClip){const cb=activeClip.computeTightBounds();if(!intersects(b,cb))return;const relation=clipRelation(activeClip,b);if(relation<0)return;if(relation===0){path.op(activeClip,PathOp.Intersect);}}
  b=path.computeTightBounds();if(Math.max(b[2]-b[0],b[3]-b[1])<minSize)return;
  path=path.asWinding();
  records.push({path,fill,opacity:Math.round(opacity*100)/100});
 }
 function walk(n,m,parent,alpha,activeClip,depth=0,isRoot=false){if(depth>40)throw Error('Recursive SVG instance');const tag=n.localName;if(['defs','style','title','desc','metadata','linearGradient','radialGradient','clipPath','mask','pattern','text'].includes(tag))return;
  const s=paint(n,parent);if(s.display==='none'||s.visibility==='hidden')return;let ctm=mul(m,transform(n.getAttribute('transform'))),opacity=alpha*parseFloat(s.opacity??1),localClip=activeClip;
  if(tag==='svg'&&!isRoot){const vb=(n.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number),x=+(n.getAttribute('x')||0),y=+(n.getAttribute('y')||0),w=+(n.getAttribute('width')||vb[2]),h=+(n.getAttribute('height')||vb[3]);if(vb.length===4&&w&&h){const frame=transformed(rectClip([[x,y,w,h]]),ctm);localClip=localClip?new Path2D(localClip).op(frame,PathOp.Intersect):frame;ctm=mul(ctm,[w/vb[2],0,0,h/vb[3],x-vb[0]*w/vb[2],y-vb[1]*h/vb[3]]);}}
  for(const [key,isMask]of [['clip-path',false],['mask',true]])if(s[key]&&s[key]!=='none'){const p=clipping(n,s[key],ctm,s,isMask);if(p)localClip=localClip?new Path2D(localClip).op(p,PathOp.Intersect):p;}
  if(tag==='use'){const href=n.getAttribute('href')||n.getAttribute('xlink:href');if(!href?.startsWith('#'))throw Error('External SVG instance');const target=lookup(n,href.slice(1));if(!target)throw Error(`Unresolved SVG instance ${href}`);walk(target,mul(ctm,[1,0,0,1,+(n.getAttribute('x')||0),+(n.getAttribute('y')||0)]),s,opacity,localClip,depth+1);return;}
  let p=shape(n);
  if(p){p=reduceLinear(p,ctm);if(s['fill-rule']==='evenodd')p.setFillType(FillType.EvenOdd);let fill=s.fill??'black';if(fill==='currentColor')fill=s.color??'black';emit(n,p,ctm,colour(n,fill),opacity*parseFloat(s['fill-opacity']??1),localClip);
   const stroke=s.stroke==='currentColor'?(s.color??'black'):s.stroke,width=parseFloat(s['stroke-width']??1),scale=Math.max(Math.hypot(ctm[0],ctm[1]),Math.hypot(ctm[2],ctm[3]));
   if(stroke&&stroke!=='none'&&width*scale>=minStroke){const cap={butt:0,round:1,square:2}[s['stroke-linecap']]??0,join={miter:0,round:1,bevel:2}[s['stroke-linejoin']]??0;emit(n,new Path2D(p).stroke({width,cap,join,miterLimit:parseFloat(s['stroke-miterlimit']??4)}),ctm,colour(n,stroke),opacity*parseFloat(s['stroke-opacity']??1),localClip);}
  }else for(const c of elements(n))walk(c,ctm,s,opacity,localClip,depth+1);
 }
 walk(root,matrix,{fill:'black',stroke:'none'},1,clip,0,true);
 return records;
}

function rdp(p,t){if(p.length<3)return p;const keep=new Set([0,p.length-1]),stack=[[0,p.length-1]];while(stack.length){const [a,b]=stack.pop(),dx=p[b][0]-p[a][0],dy=p[b][1]-p[a][1],l=dx*dx+dy*dy;let d=t*t,k=-1;for(let i=a+1;i<b;i++){const u=l?Math.max(0,Math.min(1,((p[i][0]-p[a][0])*dx+(p[i][1]-p[a][1])*dy)/l)):0,v=(p[i][0]-p[a][0]-u*dx)**2+(p[i][1]-p[a][1]-u*dy)**2;if(v>d){d=v;k=i;}}if(k>=0){keep.add(k);stack.push([a,k],[k,b]);}}return p.filter((_,i)=>keep.has(i));}
export function pathData(path,tolerance=.3,{minArea=.18,quantum=.5}={}){const canonical=path.toSVGString(),parts=canonical.match(/[MLCQZ][^MLCQZ]*/g)??[];let points=[],at=[0,0],out='',position=[0,0];const number=/-?\d*\.?\d+(?:e[-+]?\d+)?/gi,mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);
 const n=v=>String(Math.round(v)*quantum).replace(/^(-?)0\./,'$1.'),pair=(x,y)=>n(x)+(y<0?'':' ')+n(y);
 function encode(input,closed){let p=input.map(v=>v.map(n=>Math.round(n/quantum)));if(closed&&p.length>1&&p[0].every((v,i)=>v===p.at(-1)[i]))p.pop();if(p.length<3&&closed)return;let first=p[0],absolute='M'+pair(...first),relative='m'+pair(first[0]-position[0],first[1]-position[1]),text=relative.length<absolute.length?relative:absolute,previous=text[0]==='m'?'l':'L';position=first;
  for(const v of p.slice(1)){const dx=v[0]-position[0],dy=v[1]-position[1];if(!dx&&!dy)continue;const options=[['L',pair(...v)],['l',pair(dx,dy)]];if(!dy)options.push(['H',n(v[0])],['h',n(dx)]);if(!dx)options.push(['V',n(v[1])],['v',n(dy)]);const encoded=options.map(([command,args])=>({command,text:command===previous?(args.startsWith('-')?args:' '+args):command+args})).sort((a,b)=>a.text.length-b.text.length)[0];text+=encoded.text;previous=encoded.command;position=v;}
  if(closed){text+='Z';position=first;}out+=text;
 }
 function flush(closed){if(points.length>1){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}if(Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))>=.3&&(!closed||Math.abs(area)/2>=minArea))encode(rdp(points,tolerance),closed);}points=[];}
 const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);return l?Math.abs(dx*(a[1]-p[1])-(a[0]-p[0])*dy)/l:Math.hypot(p[0]-a[0],p[1]-a[1]);};
 function curve(a,b,c,d,depth=0){if(depth>12||Math.max(dist(b,a,d),dist(c,a,d))<tolerance*.45){points.push(d);return;}const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);curve(a,ab,abc,m,depth+1);curve(m,bcd,cd,d,depth+1);}
 for(const part of parts){const v=(part.slice(1).match(number)??[]).map(Number),end=v.slice(-2),tag=part[0];if(tag==='M'){flush(false);points=[end];}if(tag==='L')points.push(end);if(tag==='C')curve(at,v.slice(0,2),v.slice(2,4),end);if(tag==='Q'){const b=v.slice(0,2);curve(at,at.map((v,i)=>v+(b[i]-v)*2/3),end.map((v,i)=>v+(b[i]-v)*2/3),end);}if(tag==='Z'){flush(true);continue;}at=end;}flush(false);return out.replace(/L(?=-)/g,'L').replace(/([\d.]) -/g,'$1-').replace(/(^|[ML ])0\./g,'$1.');
}
export function markup(records,{tolerance=.3,paletteDistance=38,minArea=.18,quantum=.5}={}){
 const rgb=c=>{const h=c.match(/^#([\da-f]{6}|[\da-f]{3})$/i)?.[1];if(!h)return null;const v=h.length===3?h.split('').map(c=>c+c).join(''):h;return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16));},distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const hue=a=>{const max=Math.max(...a),min=Math.min(...a),d=max-min;if(d<18)return null;return ((max===a[0]?(a[1]-a[2])/d:max===a[1]?(a[2]-a[0])/d+2:(a[0]-a[1])/d+4)*60+360)%360;};
 const sameHue=(a,b)=>{const x=hue(a),y=hue(b);return x==null||y==null||Math.min(Math.abs(x-y),360-Math.abs(x-y))<16;};
 const weights=new Map();for(const r of records){const key=r.fill.toLowerCase(),b=r.path.computeTightBounds();weights.set(key,(weights.get(key)??0)+(b[2]-b[0])*(b[3]-b[1])*r.opacity);}
 const palette=[],colours=new Map();for(const [colour]of [...weights].sort((a,b)=>b[1]-a[1])){const value=rgb(colour);if(!value){colours.set(colour,colour);continue;}let nearest=palette.filter(p=>sameHue(value,p.rgb)).map(p=>({...p,d:distance(value,p.rgb)})).sort((a,b)=>a.d-b.d)[0];if(nearest&&nearest.d<paletteDistance)colours.set(colour,nearest.colour);else{palette.push({colour,rgb:value});colours.set(colour,colour);}}
 const batches=[];
 for(const original of records){const r={...original,fill:colours.get(original.fill.toLowerCase())},b=r.path.computeTightBounds(),expanded=[b[0]-.25,b[1]-.25,b[2]+.25,b[3]+.25];let target=null;
  if(r.opacity===1)for(let i=batches.length-1;i>=Math.max(0,batches.length-100);i--){const batch=batches[i];if(batch.fill===r.fill&&batch.opacity===1){target=batch;break;}if(batch.bounds.some(v=>intersects(v,expanded)))break;}
  if(target){target.path.addPath(r.path);target.bounds.push(b);}else batches.push({...r,path:new Path2D(r.path),bounds:[b]});
 }
 let out='';for(const batch of batches){const path=batch.opacity===1?batch.path.simplify().asWinding():batch.path,d=pathData(path,tolerance,{minArea,quantum});if(d){const fill=batch.fill.replace(/^#([\da-f])\1([\da-f])\2([\da-f])\3$/i,'#$1$2$3');out+=`<path fill="${fill}"${batch.opacity<1?` opacity="${batch.opacity}"`:''} d="${d}"/>`;}}return out;
}
