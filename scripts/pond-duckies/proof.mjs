import fs from 'node:fs';
import sharp from 'sharp';
const out='/tmp/pond-duckies';fs.mkdirSync(out,{recursive:true});
export async function renderIsland(id,view,k=.6,duckies=[]){
 const {render}=await import('../pagepond/render.mjs');
 const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/'+id+'/art.json'));
 art.floating=[...(art.floating??[]),...duckies];
 await render(art,view,k,out+'/'+id+'.png',{sleepers:false,resolveSource:s=>s.startsWith('/')?'public'+s:'public/pixi-art/themes/'+id+'/'+s});
}
if(process.argv[2]==='ponds'){
 for(const [id,v] of [['sunflower',[1000,1840,1200,800]],['pink',[5000,1400,1500,1100]],['fair',[2300,500,2600,1500]],['cathedral',[1200,2900,1200,850]],['community',[1300,1000,1400,1000]],['library',[1400,3700,1250,750]]])await renderIsland(id,v,.5);
}
