// Deterministic screenshot fallback when macOS denies headless Chromium launch.
import sharp from 'sharp';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {animatePieces} from '../../src/pixi/centre-motion.js';
const root=decodeURIComponent(new URL('../../',import.meta.url).pathname);
const duckNames=['shadow-0','tail-0','foot-0','foot-1','toe-0','toe-1','body-0','eye-0','eye-1','beak-0'];
const duck=await Promise.all(duckNames.map(async n=>{const data=await readFile(root+'public/pixi-duck/view-10-'+n+'.svg','utf8');const box=data.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);return {im:await loadImage(await sharp(Buffer.from(data)).png().toBuffer()),box}}));
const x0=Math.min(...duck.map(d=>d.box[0])),y0=Math.min(...duck.map(d=>d.box[1])),x1=Math.max(...duck.map(d=>d.box[0]+d.box[2])),y1=Math.max(...duck.map(d=>d.box[1]+d.box[3]));
function drawDuck(ctx,x,y){const s=130/(y1-y0);for(const{im,box:[dx,dy,w,h]}of duck)ctx.drawImage(im,x+(dx-(x0+x1)/2)*s,y+(dy-y1)*s,w*s,h*s)}
for(const theme of ['peaks','snow','candy']){
 const dir=root+`public/pixi-art/themes/${theme}/centre-locked/`,data=JSON.parse(await readFile(dir+'centre.json','utf8'));
 const cv=createCanvas(1500,1100),ctx=cv.getContext('2d');ctx.fillStyle='#F8F2DF';ctx.fillRect(0,0,1500,1100);ctx.fillStyle='#51452D';ctx.font='bold 23px sans-serif';ctx.fillText(data.name,30,34);ctx.font='15px sans-serif';ctx.fillText(`Locked centre | ${data.pieces.length} SVG pieces | 130-unit Duckies`,30,60);
 ctx.fillStyle=theme==='snow'?'#E2F1F5':'#A4C64E';ctx.fillRect(0,80,1500,1020);ctx.translate(750,620);ctx.scale(.60,.60);
 const entries=await Promise.all(data.pieces.map(async p=>({p,im:await loadImage(await sharp(dir+p.file).png().toBuffer()),y:p.layer==='decal'?-10000:p.layer==='back'?-9000:p.sortY??0})));
 for(const [x,y]of[[-650,-230],[620,50],[-470,360],[500,-280],[160,460],[-750,150]])entries.push({duck:[x,y],y});
 entries.sort((a,b)=>a.y-b.y);
 for(const it of entries){if(it.duck){drawDuck(ctx,...it.duck);continue}const{p,im}=it;ctx.save();ctx.drawImage(im,p.x,p.y,p.width,p.height);ctx.restore()}
 const out=`${root}../concepts/themes/work/${theme}`;await mkdir(out,{recursive:true});await writeFile(`${out}/${theme}-centre-built.png`,cv.toBuffer('image/png'));
 // All SVGs decode, anchors and authored bounds agree, every anim changes and reduced motion stays at rest.
 for(const p of data.pieces){if(p.x!==p.at[0]||p.y!==p.at[1])throw Error('bad anchor '+p.id);if(!p.animate)continue;
 const spr={x:p.x,y:p.y,visible:true,rotation:0,alpha:1,anchor:p.anchor,texture:{width:p.width,height:p.height},scale:{x:1,y:1,set(x,y){this.x=x;this.y=y}},position:{set(x,y){spr.x=x;spr.y=y}}};
 const rs=[{piece:p,sprite:spr}];animatePieces(rs,.13);const a=JSON.stringify([spr.x,spr.y,spr.scale,spr.alpha]);animatePieces(rs,.79);const b=JSON.stringify([spr.x,spr.y,spr.scale,spr.alpha]);if(a===b)throw Error('static animation '+p.id);animatePieces(rs,1,true);if(spr.x!==p.x||spr.y!==p.y||spr.alpha!==1||spr.scale.x!==1||spr.scale.y!==1)throw Error('reduced motion '+p.id);
 }
 console.log(theme,JSON.stringify({pieces:data.pieces.length,animated:data.pieces.filter(p=>p.animate).length,blocked:data.blocked.length,svgDecode:'PASS',motion:'PASS'}));
}
