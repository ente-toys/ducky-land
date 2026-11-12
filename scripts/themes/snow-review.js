import {PixiIsland} from '/src/pixi/engine.js';
import {registerMap,THEME_OF} from '/src/pixi/island-maps.js';
import {worldIsland} from '/src/pixi/world-map.js';
const load=p=>fetch(p).then(r=>r.json());
const theme=new URLSearchParams(location.search).get('theme')||'snow';
if(theme==='snow'){
 const [world,walk,harbor]=await Promise.all(['world','walk-world','harbor'].map(n=>load('/assets/world/themes/snow/'+n+'.json')));
 const sleepers=await load('/assets/world/themes/snow/sleepers-resolved.json');
 registerMap('snow',{world,walk,harbor,sleepers,art:'/pixi-art/themes/snow/art.json',sea:'#8CC8CD'});
 // Runtime-only preview binding, never writes the shared registry.
 THEME_OF.set('isle-170','snow');
 Object.assign(worldIsland('isle-170'),{theme:'snow',name:'Snowdrift',width:7500,height:5500});
}
const game=new PixiIsland({onError:e=>{window.reviewError=String(e);console.error(e)}});window.reviewGame=game;
await game.mount(document.querySelector('#game'));
if(theme==='snow')game.switchIsland('isle-170');
window.reviewCamera=(x,y,zoom)=>{game.fly=null;game.follow=false;game.fitMode=false;Object.assign(game.camera,{x,y,zoom});Object.assign(game.target,game.camera)};
window.reviewCamera(...(theme==='snow'?[3750,2750,.22]:[2900,2200,.30]));
if(theme==='snow'){
 const until=performance.now()+120000;
 while(!game.artReady('snow')){if(performance.now()>until)throw Error('Fair art load timed out');await new Promise(r=>setTimeout(r,50));}

}
window.reviewReady=true;
