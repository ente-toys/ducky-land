import fs from 'node:fs';
import {render} from '../pagepond/render.mjs';
import {checkTheme} from '../theme-index.mjs';
const out=process.env.PAGEPOND_RENDER_OUT??'artifacts/pagepond-final',art=JSON.parse(fs.readFileSync('public/pixi-art/themes/library/art.json')),harbor=JSON.parse(fs.readFileSync('rive/web/themes/library/harbor.json')),checked=checkTheme('library');
fs.mkdirSync(out,{recursive:true});
// The live harbour draws this pier procedurally. Include the same original
// timber in the static proof, so its approach never looks like a dead end.
{const j=harbor.jetty;art.decks.push({src:'/pixi-art/bridge-jetty-1.svg',x:j.foot[0]-j.width/2,y:j.foot[1]-16,width:j.width,height:j.tip[1]-j.foot[1]+32});}
const views=[['whole',[-3000,-2200,14000,10400],.25],['west-mouth',[-3050,1850,1800,1500],.8],['east-mouth',[9600,2240,1750,1600],.8],['south-mouth',[4900,5990,2400,2200],.65],['north-entries',[2750,-650,2700,1700],.7]];
for(const h of ['quillwick','inkleaf','bedtime','paperboat']){const p=art.props.filter(p=>p.hamlet===h),x0=Math.min(...p.map(p=>p.x-p.width/2)),x1=Math.max(...p.map(p=>p.x+p.width/2)),y0=Math.min(...p.map(p=>p.y-p.height)),y1=Math.max(...p.map(p=>p.y));views.push([h,[x0-220,y0-170,x1-x0+440,y1-y0+420],.7]);}
for(const [name,view,k]of views)await render(art,view,k,out+'/'+name+'.png',{beds:checked.sleepers,boats:name==='whole'?harbor.boats:[]});
fs.writeFileSync(out+'/views.json',JSON.stringify(views,null,2)+'\n');
