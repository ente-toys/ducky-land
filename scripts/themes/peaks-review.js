import {PixiIsland} from '/src/pixi/engine.js';
import {registerMap,THEME_OF} from '/src/pixi/island-maps.js';
import {worldIsland} from '/src/pixi/world-map.js';
const load=p=>fetch(p).then(r=>r.json());
const theme=new URLSearchParams(location.search).get('theme')||'peaks';
if(theme==='peaks'){
 const [world,walk,harbor,sleepers]=await Promise.all(['world','walk-world','harbor','sleepers-resolved'].map(n=>load('/rive/web/themes/peaks/'+n+'.json')));
 registerMap('peaks',{world,walk,harbor,sleepers,art:'/pixi-art/themes/peaks/art.json',sea:'#6EC9DE'});
 THEME_OF.set('isle-170','peaks');
 Object.assign(worldIsland('isle-170'),{theme:'peaks',name:'Mossnap Peaks',width:8000,height:5800});
}
const game=new PixiIsland({onError:e=>{window.reviewError=String(e);console.error(e)}});window.reviewGame=game;
await game.mount(document.querySelector('#game'));
if(theme==='peaks')game.switchIsland('isle-170');
window.reviewCamera=(x,y,zoom)=>{game.fly=null;game.follow=false;game.fitMode=false;Object.assign(game.camera,{x,y,zoom});Object.assign(game.target,game.camera)};
window.reviewCamera(...(theme==='peaks'?[4000,2900,.18]:[2900,2200,.18]));
if(theme==='peaks'){
 const until=performance.now()+120000;
 while(!game.artReady('peaks')){if(performance.now()>until)throw Error('Peaks art load timed out');await new Promise(r=>setTimeout(r,50))}
}
window.reviewReady=true;
