import {Application,Assets,Container,Sprite,Texture} from 'pixi.js';
import {loadThemeArt} from '/src/pixi/theme-art.js';
const {updateCommunityCentre} = await import(/* @vite-ignore */ '/pixi-art/themes/community/centre/animate.js');
const query=new URLSearchParams(location.search), close=query.has('centre');
const W=innerWidth,H=innerHeight;
const app=new Application();await app.init({width:W,height:H,background:'#6EC9DE',antialias:true,resolution:1,preference:'webgl'});document.body.append(app.canvas);
const camera=new Container();app.stage.addChild(camera);
const custom=query.get('cam')?.split(',').map(Number);
const k=custom?.length===3?custom[2]:close?Math.min(W/2100,H/1670):Math.min(W/8000,H/5800);
camera.scale.set(k);camera.position.set(W/2-(custom?.[0]??4000)*k,H/2-(custom?.[1]??(close?2540:2900))*k);
const cache=new Map();
const acquire=async (url,resolution)=>{if(!cache.has(url))cache.set(url,Assets.load({src:url,data:{resolution:Math.min(resolution,1)}}));return cache.get(url)};
const art=await loadThemeArt({id:'community',art:'/pixi-art/themes/community/art.json'},{acquire,release:()=>{}});
for(const g of art.groups)camera.addChild(g);
const sorted=new Container();sorted.sortableChildren=true;camera.addChild(sorted);
for(const p of art.props){p.sprite.visible=true;p.sprite.zIndex=p.sortY??p.y;sorted.addChild(p.sprite)}
const world=await fetch('./world.json').then(r=>r.json());
const harbor=await fetch('./harbor.json').then(r=>r.json());
// Preview the engine-owned harbor with the existing home wooden jetty source.
const jetty=await fetch('/pixi-art/themes/community/harbor-preview.json').then(r=>r.json());
const deck=new Sprite(await acquire('/pixi-art/themes/community/harbor-preview.svg',1));deck.position.set(jetty.x,jetty.y);deck.width=jetty.width;deck.height=jetty.height;art.decks.addChild(deck);
for(const b of harbor.boats){const s=new Sprite(await acquire('/pixi-art/boat-sail.svg',1));s.anchor.set(.5,.82);s.position.set(b.x,b.y);s.width=188;s.height=188;s.zIndex=b.y;sorted.addChild(s)}
const poses=await fetch('/src/pixi/sleep-poses.json').then(r=>r.json());
const sleepers=await fetch('/pixi-art/themes/community/resolved-sleepers.json').then(r=>r.json());
for(const b of sleepers){
 const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;
 for(const l of p.layers){const tex=await acquire(l.src,1),s=new Sprite(tex);const ww=tex.width/poses.F*u,hh=tex.height/poses.F*u,cx=(x0+x1)/2*u;
 s.position.set(b.x-(b.flip?ww-cx:cx),b.y-y1*u);s.width=ww;s.height=hh;
 if(b.flip){s.anchor.x=1;s.scale.x*=-1;}s.zIndex=b.y;sorted.addChild(s)}
}
window.communityPreview={app,art,world,sleepers,update:t=>{updateCommunityCentre(art,t,matchMedia('(prefers-reduced-motion: reduce)').matches);app.render();},ready:true};
app.ticker.add(t=>updateCommunityCentre(art,t.lastTime/1000,matchMedia('(prefers-reduced-motion: reduce)').matches));
if(query.has('still')){app.stop();window.communityPreview.update(0)}
