import fs from 'node:fs';
import {render} from '../pagepond/render.mjs';
import {checkTheme} from '../theme-index.mjs';
const A='public/pixi-art/themes/community/',art=JSON.parse(fs.readFileSync(A+'art.json')),out='../concepts/themes/work/campfire-check/final2',plan=JSON.parse(fs.readFileSync('scripts/campfire-hamlets/placement.json')),checked=checkTheme('community');
const harbor=JSON.parse(fs.readFileSync('assets/world/themes/community/harbor.json'));
fs.mkdirSync(out,{recursive:true});
const views=[['whole',[-1800,-1600,11600,9000],.25],['centre',[500,500,7200,4700],.3],['grove-north',[1800,-1050,4100,1650],.65],['life-west',[-1250,1300,2100,1700],.8],['grove-south',[1950,4950,4100,1900],.65]];
for(const h of Object.keys(plan.sites)){
 const ps=art.props.filter(p=>p.hamlet===h),x0=Math.min(...ps.map(p=>p.x-p.width/2)),x1=Math.max(...ps.map(p=>p.x+p.width/2)),y0=Math.min(...ps.map(p=>p.y-p.height)),y1=Math.max(...ps.map(p=>p.y));
 views.push([h,[x0-130,y0-100,x1-x0+260,y1-y0+240],.8]);
 const cs=ps.filter(p=>p.kind==='building'),p=cs.find(p=>/cottage-southwest/.test(p.blueprintId));
 views.push(['shadows-'+h,[p.x-340,p.y-420,1050,700],1]);
}
for(const [name,view,k]of views)await render(art,view,k,out+'/'+name+'.png',{beds:checked.sleepers,boats:harbor.boats,resolveSource:s=>s.startsWith('/')?'public'+s:A+s});
fs.writeFileSync(out+'/views.json',JSON.stringify(views,null,2));console.log('Theme',checked.ready,checked.problems);
