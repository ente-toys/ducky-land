// Preserve the authored Bezier network, round its lake landings, then paint all
// outer lips, all shadows and all blue surfaces in shared passes.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {prepareLakeJunctions} from './lake-junctions.mjs';
const stripGroup=(text,id)=>{
 const start=text.indexOf(`<g id="${id}"`);if(start<0)return text;
 const tags=/<\/?g\b[^>]*>/g;tags.lastIndex=start;let depth=0,m;
 while((m=tags.exec(text))){depth+=m[0].startsWith('</')?-1:1;if(!depth)return text.slice(0,start)+text.slice(tags.lastIndex);}
 throw Error('Unclosed ground group '+id);
};
const round=n=>Math.round(n*100)/100;
const body=text=>text.slice(text.indexOf('>')+1,text.lastIndexOf('</svg>'));
export function groundArtwork(root,art,world,clusters,lakeFiles){
 let terrain=readFileSync(path.join(root,'public/pixi-art/themes/snow',art.ground.vector),'utf8');
 terrain=stripGroup(stripGroup(stripGroup(terrain,'snow-lip'),'snow-grain'),'lake-landings');
 const prepared=prepareLakeJunctions(terrain,world);terrain=prepared.terrain;
 // The separately streamed lake must use the SAME exterior as the terrain.
 // Otherwise its old snowy lip paints a dam across each joined mouth.
 const rink=art.flats.find(p=>p.id==='rink'),file=path.join('public/pixi-art/themes/snow',rink.src);
 const source=lakeFiles.get(file);
 const originalX=rink.x+30,originalY=rink.y+30,ice=world.iceland2.rink,pad=30;
 const decoration=source.slice(source.indexOf('<path id="light-ice-swirls"'),source.lastIndexOf('</svg>'));
 const x=round(ice.x-pad),y=round(ice.y-pad),width=round(ice.width+pad*2),height=round(ice.height+pad*2);
 const lakeShell=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"><title>Frozen lake with open flared path mouths</title><path id="shore-snow" d="${prepared.unionD}" fill="#a6deec" stroke="#eef3f9" stroke-width="24" stroke-linejoin="round"/><path id="shore-shadow" d="${prepared.unionD}" fill="#a6deec" stroke="#d4dfec" stroke-width="4" stroke-linejoin="round"/><path id="lake-ice" d="${prepared.unionD}" fill="#a6deec"/><g transform="translate(${originalX} ${originalY})">${decoration}</g></svg>\n`;
 lakeFiles.set(file,lakeShell);Object.assign(rink,{x,y,width,height});
 const paths=[...terrain.matchAll(/<path\b[^>]*stroke="#a6deec"[^>]*\/>/g)].map(m=>m[0]);
 if(paths.length!==world.iceland2.routes.length)throw Error('Expected every route without retired gate stubs');
 const widen=(p,color,extra)=>p.replace('#a6deec',color).replace(/stroke-width="([\d.]+)"/,(_,w)=>`stroke-width="${+w+extra}"`);
 const junction=(color,extra=0)=>`<path data-junction-union="true" d="${prepared.unionD}" fill="${color}"${extra?` stroke="${color}" stroke-width="${extra*2}" stroke-linejoin="round"`:''}/>`;
 const lip=`<g id="snow-lip" data-routes="${world.iceland2.routes.map(r=>r.id).join(' ')}">`+
  paths.map(p=>widen(p,'#eef3f9',24)).join('')+junction('#eef3f9',12)+paths.map(p=>widen(p,'#d4dfec',4)).join('')+junction('#d4dfec',2)+'</g>';
 terrain=terrain.replace(paths[0],lip+paths[0]);
 terrain=terrain.replace(paths.at(-1),paths.at(-1)+`<g id="lake-landings">${junction('#a6deec')}</g>`);
 const marks=()=>'<g id="snow-grain"></g>';
 // Detail is baked before the courts and paths, never painted over the lane.
 const insertion=terrain.indexOf('<g clip-path="url(#snow-coast)">')+'<g clip-path="url(#snow-coast)">'.length;
 const shell=terrain.slice(0,insertion)+'GROUND_CLUSTERS'+terrain.slice(insertion);
 // Game detail is streamed separately at its actual placed size. Baking tiny
 // motifs into the low-resolution globe fallback produced the green/grey haze.
 const full=shell.replace('GROUND_CLUSTERS',marks([]));
 const files=new Map([[path.join('public/pixi-art/themes/snow',art.ground.vector),full]]);
 for(const t of art.ground.tiles){
  const svg=shell.replace('GROUND_CLUSTERS',marks([])).replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}"`);
  files.set(path.join('public/pixi-art/themes/snow',t.src),svg);
 }
 files.set('public/pixi-art/globe/snow-ground.svg',full.replace(/width="[^"]+" height="[^"]+"/,`width="1024" height="${1024*world.height/world.width}"`));
 return {files,landings:prepared.landings,paths:paths.slice(0,world.iceland2.routes.length).map((p,i)=>({route:world.iceland2.routes[i].id,d:p.match(/\bd="([^"]+)"/)[1],width:world.iceland2.routes[i].width,sides:[-1,1],band:12,shadow:2}))};
}
// Standing drawings use small shared SVG crops in the existing bounded pool.
// Crop keys depend on source + display size, never placement id, so 536 pines
// reuse exactly the same three sets of source textures.
export function streamArtwork(root,art,files){
 const cache=new Map();
 for(const p of [...art.props,...art.flats]){
  if(!p.finalKind)continue;
  const key=[p.src,p.width,p.height].join('|');
  if(!cache.has(key)){
   const source=files.get('public/pixi-art/themes/snow/'+p.src)??readFileSync(path.join(root,'public/pixi-art/themes/snow',p.src),'utf8');
   const inner=source.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/,'$1').replace(/(<svg\b[^>]*?)\sheight="[^"]*"/,'$1').replace('<svg',`<svg width="${p.width}" height="${p.height}"`);
   const name=path.basename(p.src,'.svg')+'-'+p.width+'-'+p.height,tiles=[];
   for(let y=0;y<p.height;y+=128)for(let x=0;x<p.width;x+=128){
    const width=Math.min(128,p.width-x),height=Math.min(128,p.height-y),src=`final/props/crops/${name}-${x}-${y}.svg`;
    files.set('public/pixi-art/themes/snow/'+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">${inner}</svg>\n`);
    tiles.push({src,x,y,width,height,resolution:4,margin:16});
   }
   cache.set(key,tiles);
  }
  p.tiles=structuredClone(cache.get(key));p.resolution=p.preload?Math.min(p.resolution??4,Math.floor(4096/Math.max(p.width,p.height)*16)/16):4;
 }
}
