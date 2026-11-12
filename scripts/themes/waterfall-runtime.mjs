// Theme-only QA harness. Uses the actual production art loader, sleepers, surf and floating layers.
import {Application,Assets,Container,Sprite} from 'pixi.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
import {createSleeper,SLEEP_ASSETS} from '../../src/pixi/sleeper.js';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {animatePieces} from '../../src/pixi/centre-motion.js';
import {createBeachSurf,shoreOf} from '../../src/pixi/surf.js';
const base='/pixi-art/themes/waterfall/';
const [world,walk,harbor,manifest]=await Promise.all(['/assets/world/themes/waterfall/world.json','/assets/world/themes/waterfall/walk-world.json','/assets/world/themes/waterfall/harbor.json',base+'art.json'].map(u=>fetch(u).then(r=>r.json())));
const app=new Application();await app.init({width:innerWidth,height:innerHeight,antialias:true,resolution:1,background:manifest.sea,autoStart:false,preference:'webgl'});document.body.append(app.canvas);
const params=new URLSearchParams(location.search),k=+(params.get('k')||.265),scene=new Container();scene.scale.set(k);scene.position.set((innerWidth-world.width*k)/2,(innerHeight-world.height*k)/2);app.stage.addChild(scene);
if(params.has('x'))scene.position.set(innerWidth/2-Number(params.get('x'))*k,innerHeight/2-Number(params.get('y'))*k);
const cache=new Map();const acquire=(src,resolution)=>{if(!cache.has(src))cache.set(src,Assets.load({src,data:{resolution}}));return cache.get(src)};
const art=await loadThemeArt({id:'waterfall',art:base+'art.json'},{acquire,release:()=>{}});
const water=new Container(),objects=new Container({sortableChildren:true});
scene.addChild(art.ground,water,art.floatLayer,art.decks,art.shadows,objects);
for(const p of art.props){p.sprite.visible=true;objects.addChild(p.sprite)}
const surf=createBeachSurf(water,shoreOf(world));
// The primary jetty is supplied by the game harbor, not art.json.
const jetty=new Sprite(await acquire('/pixi-art/bridge-jetty-1.svg',1.5));jetty.position.set(2102.4,620);jetty.width=229.2;jetty.height=760;art.decks.addChild(jetty);
const boats=[];for(const b of harbor.boats){const boat=new Sprite(await acquire('/pixi-art/boat-sail.svg',2));boat.anchor.set(.5,.82);boat.position.set(b.x,b.y+30);boat.width=188;boat.height=216;boat.zIndex=b.y;objects.addChild(boat);boats.push({boat,y:boat.y})}
await Assets.load(SLEEP_ASSETS);
const beds=resolveSleepSpots({...world,...walk},manifest.props,geometry(walk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const sleepers=beds.map((bed,i)=>{const s=createSleeper(bed,i+41);s.root.visible=true;s.root.scale.set(.81*(.88*.24*3)/3);s.root.position.set(bed.x,bed.y);s.root.zIndex=bed.y;objects.addChild(s.root);return s});
window.waterfallQA={ready:true,props:art.props.length,trees:art.props.filter(p=>/tree/i.test(p.name)).length,sleepers:beds.length,dropped:beds.bad,zoom:k,renderer:app.renderer.type};
const centreRecords=art.props.filter(p=>p.centrePiece?.animate).map(p=>({piece:p.centrePiece,sprite:p.sprite}));
let frame=0;function draw(){const t=frame++/60;surf.update(t,false,()=>true);animatePieces(centreRecords,t,matchMedia('(prefers-reduced-motion: reduce)').matches);for(const s of sleepers)s.update(t);for(const {boat,y}of boats)boat.y=y+Math.sin(t*1.6+y)*3;for(const f of art.floating){f.sprite.y=f.y+Math.sin(t*1.4+f.phase)*2}app.render();requestAnimationFrame(draw)}draw();
