import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';
import {inPoly,inShape} from '../../assets/world/island-geometry.mjs';
process.argv[2]='built';
const {render}=await import('./render.mjs');
const {out,plan}=await import('./design.mjs');
const read=p=>JSON.parse(readFileSync(p));
const root='scripts/bigger-bog/evidence/fix';
mkdirSync(out+'/bog-fixed-crops',{recursive:true});
function audit(art,world){
 const list=art.decks.filter(p=>/bridge|jetty|boardwalk|pier|crossing/i.test([p.id,p.name,p.src].join(' ')));
 return list.map(p=>{
  const b=world.bridges.find(b=>b.id===p.id);
  if(b){let wet=0,total=0;for(let y=b.y-b.h*.3;y<=b.y+b.h*.3;y+=20)for(let x=b.x-b.w*.4;x<=b.x+b.w*.4;x+=20){total++;if(world.water.some(w=>inShape(x,y,w)))wet++;}
   const endsOnBanks=[b.x-b.w/2+25,b.x+b.w/2-25].every(x=>inPoly(x,b.y,world.coast)&&!world.water.some(w=>inShape(x,b.y,w)));
   return {id:p.id,kind:'river bridge',center:[b.x,b.y],water:world.water.filter(w=>inShape(b.x,b.y,w)).map(w=>w.id),wetDeckSamples:wet,totalDeckSamples:total,endsOnBanks};
  }
  const y=p.y+p.height/2;
  return {id:p.id,kind:'sea pier',center:[p.x+p.width/2,y],water:!inPoly(p.x+p.width*.6,y,world.coast)?['sea']:[],landApproach:inPoly(p.x,y,world.coast),outerDeckInSea:!inPoly(p.x+p.width-20,y,world.coast)};
 });
}
const art=read('public/pixi-art/themes/bog/art.json'),world=read('assets/world/themes/bog/world.json');
const result={before:audit(read(root+'/before-art.json'),read(root+'/before-world.json')),after:audit(art,world),excludedDeck:{id:'boxing-raised-canvas',reason:'Raised boxing stage. It is neither a bridge nor a jetty and belongs on dry land.'},oldCoastCrossings:0,riverCount:world.water.filter(w=>w.poly).length};
if(result.after.length!==5||result.after.some(p=>!p.water.length||p.kind==='river bridge'&&!p.endsOnBanks))throw Error('A bridge or pier has no wet span or dry bank landings');
writeFileSync(root+'/bridge-audit.json',JSON.stringify(result,null,2)+'\n');
await render(art,out+'/bog-fixed.png');
for(const [id,cx,cy,w,h]of [['bridge',2335,-15,1700,1250],['north-bridge',4000,-825,1700,1250],['sea-pier',9148,6150,1500,1100],['road-junction',3955,5925,1700,1250],['lane',175,120,1700,1250],['common',2695,6474,1700,1250]])await render(art,out+'/bog-fixed-crops/'+id+'.png',{x:cx-w/2,y:cy-h/2,w,h,k:.8});
for(const c of plan.communities)await render(art,out+'/bog-fixed-crops/'+c.id+'.png',{x:c.crop[0]-1450,y:c.crop[1]-1100,w:2900,h:2200,k:.8});
const sheet=[];
for(const [src,left]of [[out+'/../cursor-camp-paths-ref.jpg',0],[out+'/bog-fixed-crops/road-junction.png',700],[out+'/bog-fixed-crops/lane.png',1400]])sheet.push({input:await sharp(src).resize(700,620,{fit:'contain',background:'#F0E1B4'}).png().toBuffer(),left,top:75});
sheet.push({input:Buffer.from('<svg width="2100" height="750"><g fill="#39472D" font-family="Arial" font-size="24"><text x="25" y="43">Cursor Camp, look reference</text><text x="725" y="43">Bog junction, 0.8 px/unit source</text><text x="1425" y="43">Bog lane, 0.8 px/unit source</text><text x="25" y="728">Bog original art: uneven raised banks, overhanging grass, worn sand, ruts and edge stones.</text></g></svg>'),left:0,top:0});
await sharp({create:{width:2100,height:750,channels:4,background:'#F0E1B4'}}).composite(sheet).png().toFile(out+'/bog-fixed-paths-vs-reference.png');
console.log('Five wet crossings audited before/after; overview and ten detail crops saved. Static production asset assembly, 0.8 px/unit crops.');
