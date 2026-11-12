import {PixiIsland} from '/src/pixi/engine.js';
import {registerMap,THEME_OF} from '/src/pixi/island-maps.js';
import {worldIsland} from '/src/pixi/world-map.js';
const load=p=>fetch(p).then(r=>r.json());
const theme=new URLSearchParams(location.search).get('theme')||'fair';
if(theme==='fair'){
 const [world,walk,harbor]=await Promise.all(['world','walk-world','harbor'].map(n=>load('/assets/world/themes/fair/'+n+'.json')));
 const sleepers=await load('/assets/world/themes/fair/sleepers-resolved.json');
 registerMap('fair',{world,walk,harbor,sleepers,art:'/pixi-art/themes/fair/art.json',sea:'#7FD3D6'});
 THEME_OF.set('isle-170','fair');
 Object.assign(worldIsland('isle-170'),{theme:'fair',name:'Waddlewish Fair',width:7250,height:4850});
}
const game=new PixiIsland({onError:e=>{window.reviewError=String(e);console.error(e)}});window.reviewGame=game;
await game.mount(document.querySelector('#game'));
if(theme==='fair')game.switchIsland('isle-170');
window.reviewCamera=(x,y,zoom)=>{game.fly=null;game.follow=false;game.fitMode=false;Object.assign(game.camera,{x,y,zoom});Object.assign(game.target,game.camera)};
window.reviewCamera(...(theme==='fair'?[3625,2425,.25]:[2900,2200,.30]));
if(theme==='fair'){
 const until=performance.now()+120000;
 while(!game.artReady('fair')){if(performance.now()>until)throw Error('Fair art load timed out');await new Promise(r=>setTimeout(r,50));}

}
window.reviewReady=true;
