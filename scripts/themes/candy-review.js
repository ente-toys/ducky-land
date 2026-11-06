import {PixiIsland} from '/src/pixi/engine.js';
import {registerMap,THEME_OF} from '/src/pixi/island-maps.js';
import {worldIsland} from '/src/pixi/world-map.js';
const load=p=>fetch(p).then(r=>r.json());
const theme=new URLSearchParams(location.search).get('theme')||'candy';
if(theme==='candy'){
 const [world,walk,harbor]=await Promise.all(['world','walk-world','harbor'].map(n=>load('/rive/web/themes/candy/'+n+'.json')));
 const sleepers=await load('/rive/web/themes/candy/sleepers-resolved.json');
 registerMap('candy',{world,walk,harbor,sleepers,art:'/pixi-art/themes/candy/art.json',sea:'#8CC8CD'});
 // Runtime-only preview binding, never writes the shared registry.
 THEME_OF.set('isle-170','candy');
 Object.assign(worldIsland('isle-170'),{theme:'candy',name:'Candy Coast',width:7250,height:4850});
}
const game=new PixiIsland({onError:e=>{window.reviewError=String(e);console.error(e)}});window.reviewGame=game;
await game.mount(document.querySelector('#game'));
if(theme==='candy')game.switchIsland('isle-170');
window.reviewCamera=(x,y,zoom)=>{game.fly=null;game.follow=false;game.fitMode=false;Object.assign(game.camera,{x,y,zoom});Object.assign(game.target,game.camera)};
window.reviewCamera(...(theme==='candy'?[3625,2425,.25]:[2900,2200,.30]));
if(theme==='candy'){
 const until=performance.now()+120000;
 while(!game.artReady('candy')){if(performance.now()>until)throw Error('Candy art load timed out');await new Promise(r=>setTimeout(r,50));}

}
window.reviewReady=true;
