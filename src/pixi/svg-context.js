import {GraphicsContext,GraphicsPath,Matrix} from 'pixi.js';
// boss 8 Nov (hand-drawn islets): our hand-written SVG, drawn as real Pixi geometry so it stays sharp at any zoom. Pixi's own
// SVG parser drops what our art leans on (an inherited fill-opacity, fill="none" under a filled group, round joins, and
// placing a kit piece with translate/scale), so this reads the same file the way a browser does. It understands exactly
// what the islet art uses: <g>, <path>, <circle>, <ellipse>, <rect>, <line>, <polyline>, <polygon>; fill, stroke and their
// opacities, stroke-width, -linecap, -linejoin, -miterlimit, fill-rule, opacity, and transform with translate / scale /
// matrix / rotate, plus local <use> references. Definitions only draw when referenced.
const INHERITED=['fill','stroke','stroke-width','fill-opacity','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','fill-rule'];
const ROOT={fill:'#000','stroke':'none','stroke-width':'1','fill-opacity':'1','stroke-opacity':'1','stroke-linecap':'butt','stroke-linejoin':'miter','stroke-miterlimit':'4','fill-rule':'nonzero',opacity:1};
const num=(el,name,fallback=0)=>{const v=parseFloat(el.getAttribute(name));return Number.isFinite(v)?v:fallback;};
function transformOf(text){
 const m=new Matrix();
 for(const [,op,args]of text.matchAll(/(\w+)\s*\(([^)]*)\)/g)){
  const a=args.split(/[\s,]+/).filter(Boolean).map(Number),t=new Matrix();
  if(op==='translate')t.translate(a[0]??0,a[1]??0);
  else if(op==='scale')t.scale(a[0]??1,a[1]??a[0]??1);
  else if(op==='rotate'){if(a.length>2)t.translate(-a[1],-a[2]);t.rotate((a[0]??0)*Math.PI/180);if(a.length>2)t.translate(a[1],a[2]);}
  else if(op==='matrix')t.set(...a);
  else throw Error(`svg-context: transform ${op} is not drawn`);
  m.append(t);   // SVG applies the list right to left: m = m * t
 }
 return m;
}
const color=v=>v&&v!=='none'?v:null;
function draw(ctx,el,style,matrix,refs,stack=new Set()){
 const tag=el.tagName.toLowerCase();
 if(tag==='title'||tag==='desc'||tag==='defs'||tag==='metadata')return;
 const s={...style};
 for(const k of INHERITED){const v=el.getAttribute(k);if(v&&v!=='inherit')s[k]=v.trim();}
 if(el.getAttribute('opacity'))s.opacity=style.opacity*parseFloat(el.getAttribute('opacity'));
 let m=matrix;
 if(el.getAttribute('transform'))m=matrix.clone().append(transformOf(el.getAttribute('transform')));
 if(tag==='use'){
  const href=el.getAttribute('href')||el.getAttributeNS('http://www.w3.org/1999/xlink','href')||el.getAttribute('xlink:href'),ref=refs.get(href?.slice(1));
  if(!href?.startsWith('#')||!ref||stack.has(ref))throw Error(`svg-context: invalid reference ${href}`);
  draw(ctx,ref,s,m.clone().append(new Matrix(1,0,0,1,num(el,'x'),num(el,'y'))),refs,new Set([...stack,ref]));return;
 }
 if(tag==='g'||tag==='svg'){const kids=el.childNodes;for(let n=0;n<kids.length;n++)if(kids[n].nodeType===1)draw(ctx,kids[n],s,m,refs,stack);return;}
 const fill=color(s.fill),stroke=color(s.stroke);
 if(!fill&&!stroke)return;
 const scale=Math.sqrt(Math.abs(m.a*m.d-m.b*m.c));   // geometry is transformed point by point, so the pen is scaled here
 ctx.setTransform(m);ctx.beginPath();
 switch(tag){
  case 'path':ctx.path(new GraphicsPath(el.getAttribute('d'),s['fill-rule']==='evenodd'));break;
  case 'circle':ctx.circle(num(el,'cx'),num(el,'cy'),num(el,'r'));break;
  case 'ellipse':ctx.ellipse(num(el,'cx'),num(el,'cy'),num(el,'rx'),num(el,'ry'));break;
  case 'rect':{const rx=num(el,'rx',num(el,'ry'));if(rx>0)ctx.roundRect(num(el,'x'),num(el,'y'),num(el,'width'),num(el,'height'),rx);else ctx.rect(num(el,'x'),num(el,'y'),num(el,'width'),num(el,'height'));break;}
  case 'line':ctx.moveTo(num(el,'x1'),num(el,'y1')).lineTo(num(el,'x2'),num(el,'y2'));break;
  case 'polyline':case 'polygon':{const p=(el.getAttribute('points')||'').trim().split(/[\s,]+/).map(Number);ctx.poly(p,tag==='polygon');break;}
  default:throw Error(`svg-context: <${tag}> is not drawn`);
 }
 if(fill&&tag!=='line'&&tag!=='polyline')ctx.fill({color:fill,alpha:s.opacity*parseFloat(s['fill-opacity'])});
 if(stroke)ctx.stroke({color:stroke,alpha:s.opacity*parseFloat(s['stroke-opacity']),width:parseFloat(s['stroke-width'])*scale,cap:s['stroke-linecap'],join:s['stroke-linejoin'],miterLimit:parseFloat(s['stroke-miterlimit'])});
}
// text: an SVG document. Returns a GraphicsContext in viewBox units.
export function svgContext(text,parse=t=>new DOMParser().parseFromString(t,'image/svg+xml')){
 const root=parse(text).documentElement,ctx=new GraphicsContext();
 const refs=new Map();
 for(const el of Array.from(root.getElementsByTagName('*'))){const id=el.getAttribute('id');if(id)refs.set(id,el);}
 draw(ctx,root,ROOT,new Matrix(),refs);
 ctx.setTransform(new Matrix());
 return ctx;
}
