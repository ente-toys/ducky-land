import {readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {HOME_MAP,mapOf} from '../../src/pixi/island-maps.js';
import {canSail,boardingPoint,HARBOR,landingSpot,landingApproach,setSailDestination,destinationsFor} from '../../src/pixi/islands.js';
import {offsetOf} from '../../src/pixi/world-map.js';
const E=JSON.parse(readFileSync('src/pixi/home-expansion.json')),K=.18,px=p=>[Math.round(p.x*K+278),Math.round(p.y*K+204)];
console.log('origin,centre',HOME_MAP.origin,HOME_MAP.cx,HOME_MAP.cy,'harbor',px(HARBOR.land),px(HARBOR.water),canSail(HARBOR.water.x,HARBOR.water.y));
for(const [i,b]of HOME_MAP.boatSpots().entries()){const p=boardingPoint({...b,islandId:'home'});console.log('boat',i,px(b),canSail(b.x,b.y),'board',p,Math.round(Math.hypot(b.x-p.x,b.y-p.y)),HOME_MAP.nav().walkable(p.x,p.y));}
for(const p of E.places){const n=HOME_MAP.nav(),path=n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...p.point);console.log(p.id,n.walkable(...p.point),'path',path.length,path.at(-1));}
for(const d of destinationsFor('home')){console.log('route to',d.destination,!!setSailDestination({islandId:'home',...HARBOR.water},d.dock.x,d.dock.y));}
const vite=await createServer({configFile:false,cacheDir:'/private/tmp/ducky-bigger-check-vite',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,watch:null},logLevel:'error'});
try{const P=await vite.ssrLoadModule('/src/pixi/placements.js'),baseline=JSON.parse(readFileSync('../concepts/themes/world-map/bigger/work/original-composition.json')),props=P.createPlacements(),old=props.filter(p=>!String(p.id).startsWith('bigger-'));
console.log('original props preserved',JSON.stringify(old)===JSON.stringify(baseline.props),'decals preserved',JSON.stringify(P.homeDecals(props))===JSON.stringify(baseline.decals));
}finally{await vite.close();}
