"""Write self-contained, file://-safe previews of the actual layered SVG manifests."""
import pathlib,json,base64
ROOT=pathlib.Path(__file__).resolve().parents[5]
def uri(path,mime):return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
for theme in ['cathedral','canal']:
 f=ROOT/f'public/pixi-art/themes/{theme}/centre';d=json.loads((f/'centre.json').read_text())
 for p in d['pieces']:p['uri']=uri(f/p['file'],'image/svg+xml')
 d['crowd']=json.loads((f/'preview-crowd.json').read_text());d['duck']=uri(f/'source/ducky-scale.png','image/png')
 d['bg']='#89c332' if theme=='cathedral' else '#56c0ce'
 con=uri(f/'source/locked-concept.png','image/png')
 html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>THEME centre, locked build</title>
<style>*{box-sizing:border-box}body{margin:0;background:#faf8f0;color:#39452f;font:15px system-ui}header{padding:22px 28px;display:flex;align-items:center;gap:24px}h1{font-size:20px;margin:0}label{margin-left:auto}button{padding:8px 13px;background:#fff9e9;border:1px solid #aaa387;border-radius:6px;color:inherit;cursor:pointer}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:0 24px 24px}section{min-width:0}h2{font-size:14px;font-weight:500}img,canvas{width:100%;height:auto;display:block}p{margin:12px 28px;font-size:13px}@media(max-width:800px){main{grid-template-columns:1fr}header{flex-wrap:wrap}}</style>
<header><h1>THEME centre</h1><span>Locked concept and layered SVG build</span><label>Duckies <select id="count"><option>0</option><option>12</option><option selected>100</option></select></label><button id="collision">Show footprints</button></header>
<main><section><h2>LOCKED concept</h2><img src="CONCEPT"></section><section><h2>Built from centre.json, sorted with Duckies</h2><canvas id="scene"></canvas></section></main><p>130-unit Duckies. Ground layers first, then front pieces and Duckies by sortY. No island or world files are loaded or changed.</p>
<script>const data=DATA;
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),pcs=data.pieces;
const minX=Math.min(...pcs.map(p=>p.x))-55,minY=Math.min(...pcs.map(p=>p.y))-55;
const maxX=Math.max(...pcs.map(p=>p.x+p.width))+55,maxY=Math.max(...pcs.map(p=>p.y+p.height))+55;
const S=.5;canvas.width=Math.ceil((maxX-minX)*S);canvas.height=Math.ceil((maxY-minY)*S);
const load=src=>new Promise((resolve,reject)=>{const im=new Image;im.onload=()=>resolve(im);im.onerror=reject;im.src=src});
let debug=false;async function init(){const imgs=await Promise.all(pcs.map(p=>load(p.uri)));pcs.forEach((p,i)=>p.img=imgs[i]);data.duckImg=await load(data.duck);render();window.previewReady=true;}
function deckY(x,y){for(const a of data.arches||[]){const dx=a.b[0]-a.a[0],dy=a.b[1]-a.a[1],t=((x-a.a[0])*dx+(y-a.a[1])*dy)/(dx*dx+dy*dy),side=((x-a.a[0])*dy-(y-a.a[1])*dx)/Math.hypot(dx,dy);if(t>0&&t<1&&Math.abs(side)<=a.w/2+12)return y-a.r*4*t*(1-t)}return y}
function piece(p){ctx.drawImage(p.img,(p.x-minX)*S,(p.y-minY)*S,p.width*S,p.height*S)}
function render(){ctx.fillStyle=data.bg;ctx.fillRect(0,0,canvas.width,canvas.height);for(const layer of ['decal','back'])pcs.filter(p=>p.layer===layer).forEach(piece);
const n=+document.querySelector('#count').value;let sorted=pcs.filter(p=>['sorted','front'].includes(p.layer)).map(p=>({y:p.sortY,p}));data.crowd.slice(0,n).forEach(([x,y])=>sorted.push({y,x,duck:true}));sorted.sort((a,b)=>a.y-b.y||(a.duck?-1:1));
for(const item of sorted){if(item.duck){const h=130*S,w=data.duckImg.width/data.duckImg.height*h;ctx.drawImage(data.duckImg,(item.x-minX)*S-w/2,(deckY(item.x,item.y)-minY)*S-h,w,h)}else piece(item.p)}
if(debug){ctx.save();ctx.translate(-minX*S,-minY*S);ctx.scale(S,S);for(const [key,fill,stroke]of [['walkable','#35b96522','#26813e'],['blocked','#ec505055','#c22']])for(const shape of data[key]){ctx.beginPath();shape.poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.fill();ctx.stroke()}ctx.restore()}}
document.querySelector('#count').onchange=render;document.querySelector('#collision').onclick=()=>{debug=!debug;render()};init().catch(e=>{window.previewError=String(e);console.error(e)});</script></html>'''
 html=html.replace('THEME',theme.title()).replace('CONCEPT',con).replace('DATA',json.dumps(d))
 (f/'preview.html').write_text(html)
 print(f/'preview.html')
