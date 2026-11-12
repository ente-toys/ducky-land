// Authored Home-only corrections. Surface repetition is brushwork, never prop placement.
import {readFileSync,writeFileSync} from 'node:fs';
import {inPoly} from '../../../assets/world/island-geometry.mjs';
export function finishProps({E,D,svg,custom,kit,reuse,plant,bench,flowers,at}) {
 const roofs=['#df7050','#739b6b','#bc7956','#d8a74d','#849bb1','#b97e91'];
 const walls=['#fff0c7','#f4dfb1','#e3eac4','#f5dfce','#d4e4d3','#efe3bc'];
 for(const c of E.communities)for(const [i,id]of c.homes.entries()){
  const p=E.props.find(p=>p.id===id),file=`${D}/${p.asset}.svg`;
  let s=readFileSync(file,'utf8');
  const roof={townhouse:'#f16e4b',cottage:'#ffcf50',farmhouse:'#d58b49',studio:'#b2b7dc','fisher-cottage':'#6ec9de'}[p.asset];
  const wall=/farmhouse|studio/.test(p.asset)?'#f9e8b2':p.asset==='fisher-cottage'?'#b5d9d0':'#fff0c7';
  s=s.replaceAll(`fill="${roof}"`,`fill="${roofs[(i+E.communities.indexOf(c))%roofs.length]}"`)
   .replaceAll(`fill="${wall}"`,`fill="${walls[(i*2+E.communities.indexOf(c))%walls.length]}"`);
  const w=p.width,h=p.height,sx=[.88,1,.95,1.04,.91,1.02][i],sy=[.90,1.06,1,.94,1.02,.86][i];
  // Keep the doorway and base anchored; the existing conservative solid footprint still fits.
  s=s.replace('<g stroke=',`<g transform="translate(${w*(1-sx)/2} ${h*(1-sy)}) scale(${sx} ${sy})" stroke=`);
  let detail='';
  if(i%3===0)detail=`<path d="M${w*.23} 138V94L${w*.32} 62L${w*.41} 94V138Z" fill="${walls[i]}"/><path d="M${w*.20} 98L${w*.32} 52L${w*.44} 98" fill="none" stroke="${roofs[i]}" stroke-width="15"/><path d="M${w*.29} 103H${w*.35}V129H${w*.29}Z" fill="#6ec9de"/>`;
  if(i%3===1)detail=`<path d="M75 ${h-240}H150V${h-145}H75Z M${w-150} ${h-240}H${w-75}V${h-145}H${w-150}Z" fill="none" stroke="${roofs[i]}" stroke-width="12"/><path d="M${w*.5-84} ${h-213}H${w*.5+84}L${w*.5+104} ${h-178}H${w*.5-104}Z" fill="${roofs[i]}"/>`;
  if(i%3===2)detail=`<path d="M${w*.65} ${h-105}V${h-215}H${w*.84}V${h-105}" fill="#f4dfb1"/><path d="M${w*.61} ${h-215}L${w*.74} ${h-258}L${w*.88} ${h-215}Z" fill="${roofs[i]}"/><path d="M${w*.71} ${h-188}H${w*.79}V${h-146}H${w*.71}Z" fill="#6ec9de"/>`;
  s=s.replace('</g></svg>',detail+'</g></svg>');const name=`${p.asset}-${c.id}-${i+1}`;
  writeFileSync(`${D}/${name}.svg`,s);p.src=`/pixi-art/home-communities/${name}.svg`;p.houseVariant={roof:roofs[(i+E.communities.indexOf(c))%6],wall:walls[(i*2+E.communities.indexOf(c))%6],widthScale:sx,heightScale:sy,feature:['dormer','shutters-and-wide-porch','garden-bay'][i%3]};
 }
 // Each common has its own use. The two tested running discs remain entirely clear.
 E.commons=[
  {id:'cider-grove',name:'Ciderbasket Grove',point:at([137,474]),use:'apple harvest and shared picnic'},
  {id:'seed-share',name:'Seedshare Beds',point:at([1047,231]),use:'seed nursery between gardeners and farmers'},
  {id:'willow-rest',name:'Willowrest Green',point:at([1435,746]),use:'shaded east-coast picnic and reading lawn'},
  {id:'hay-meadow',name:'Cloverhay Common',point:at([699,1164]),use:'haymaking beside a clear running lawn'},
  {id:'west-picnic',name:'Petalblanket Green',point:at([46,947]),use:'makers picnic and flower cutting'},
  {id:'north-orchard',name:'Pearbutton Orchard',point:at([445,132]),use:'household fruit and a harvest table'}
 ];
 for(const[x,y]of [[64,436],[130,420],[207,449],[78,525],[211,533],[385,133],[446,100],[499,141]])reuse('apple-tree-1589',x,y,'commons',[31,22,9]);
 for(const[x,y]of [[1030,157],[1057,182],[1085,201]])reuse('raised-bed-1179',x,y,'commons',[115,28,15]);
 kit('picnic-table',130,485,.17,'commons',[85,31,14]);kit('picnic-table',1431,739,.17,'commons',[85,31,14]);kit('picnic-table',36,942,.15,'commons',[75,28,14]);
 for(const[x,y]of [[1390,690],[1484,704],[1456,812],[1388,786]])plant('tree-3',x,y,'commons',1.15);
 for(const[x,y]of [[610,1164],[642,1180],[748,1169],[794,1168]])reuse('flour-sacks',x,y,'commons',[65,22]);
 bench(449,158,'commons');bench(100,464,'commons');bench(1401,767,'commons');
 for(const[x,y]of [[92,472],[162,514],[1020,204],[1465,749],[58,906],[674,1154],[479,149]])flowers(x,y,'commons');
 svg('river-reeds',170,180,`<path d="M41 173Q68 86 39 29 M68 174Q92 89 81 9 M94 175Q121 111 134 46 M35 175Q22 129 7 113 M91 176Q149 134 161 102" fill="none" stroke="#4b933b" stroke-width="8"/><path d="M37 57L31 28 M80 39V9 M132 68L139 40" stroke="#885931" stroke-width="13"/>`);
 for(const[x,y]of [[428,833],[559,829],[773,882],[946,914],[898,1050],[824,1178],[1322,429],[1252,491],[1438,398]])custom('river-reeds',x,y,170,180,'river-banks',null,.65);
}
export function finishGround({E,D,svg,at,px,curve,sample,roads,old}) {
 const protectedCoast=JSON.parse(readFileSync('src/pixi/walk-shapes.json')).coast.map(px);
 const ribbon=(points,width)=>{const a=sample(points),left=[],right=[];for(let i=0;i<a.length;i++){const b=a[Math.max(0,i-1)],c=a[Math.min(a.length-1,i+1)],dx=c[0]-b[0],dy=c[1]-b[1],l=Math.hypot(dx,dy)||1,w=width/2*(1+.09*Math.sin(i*.37));left.push([a[i][0]-dy/l*w,a[i][1]+dx/l*w]);right.push([a[i][0]+dy/l*w,a[i][1]-dx/l*w]);}for(const bank of [left,right])for(let i=0;i<bank.length;i++){let t=1;while(inPoly(...bank[i],protectedCoast)&&t>.02){t-=.025;bank[i]=[a[i][0]+(bank[i][0]-a[i][0])*.92,a[i][1]+(bank[i][1]-a[i][1])*.92];}}return [...left,...right.reverse()];};
 const rivers=[
  {id:'old-shore-canal',name:'Oldshore Brook',width:54,points:[[396,852],[434,847],[465,798],[532,817],[630,841],[695,850],[754,865],[812,844],[874,846],[933,870]]},
  {id:'clover-run',name:'Clover Run',width:26,points:[[933,870],[955,922],[935,987],[882,1052],[862,1120],[835,1193],[824,1275]]},
  {id:'mill-stream',name:'Millrill',width:25,points:[[1400,385],[1370,399],[1310,409],[1265,444],[1262,475],[1224,505],[1263,542],[1340,557]]}
 ];
 const polygons=rivers.map(r=>({...r,poly:ribbon(r.points,r.width)}));
 polygons.push({id:'millhead-pond',name:'Millhead Pond',poly:[[1373,385],[1382,365],[1408,361],[1429,379],[1422,398],[1397,409]]});
 polygons.push({id:'quay-tidal-inlet',name:'Reedwhistle Tidal Inlet',poly:[[875,1195],[940,1183],[1004,1190],[1080,1183],[1154,1202],[1151,1252],[1040,1291],[907,1255]]});
 // Clip the river on the old bank. This leaves every original ground pixel in place.
 const water=polygons.map(r=>{const p=r.poly.map(at);return{id:r.id,x:p.reduce((s,p)=>s+p[0],0)/p.length,y:p.reduce((s,p)=>s+p[1],0)/p.length,rx:1,ry:1,poly:p};});
 E.rivers=rivers.map(r=>({...r,points:r.points.map(at),width:r.width/.18}));E.riverWater=water;
 const additions=[];
 // Original dry jetties become water crossings, retaining their exact artwork and arch.
 const legacy=[
  {id:'old-jetty-1',a:[3320,3319],b:[3320,3730],w:115},
  {id:'old-jetty-2',a:[1137.84,3066.05],b:[940.19,3417.43],w:84},
  {id:'old-jetty-3',a:[2320.86,3264.02],b:[2288.93,3859.97],w:84},
  {id:'old-jetty-5',a:[5034.08,1638.41],b:[5469.9,1681.99],w:84}
 ];
 const bridgeRect=(id,a,b,w)=>({id,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,w:Math.max(w,Math.abs(b[0]-a[0])+w),h:Math.max(w,Math.abs(b[1]-a[1])+w)});
 E.riverBridges=legacy.map(({id,a,b,w})=>bridgeRect(id,a,b,w));
 for(const [i,b]of E.walkways.entries())E.riverBridges.push(bridgeRect('existing-deck-'+i,b.a,b.b,b.w));
 // Intersections of authored road and river centrelines determine the required crossings.
 function intersect(a,b,c,d){const ax=b[0]-a[0],ay=b[1]-a[1],bx=d[0]-c[0],by=d[1]-c[1],den=ax*by-ay*bx;if(Math.abs(den)<1e-6)return null;const t=((c[0]-a[0])*by-(c[1]-a[1])*bx)/den,u=((c[0]-a[0])*ay-(c[1]-a[1])*ax)/den;return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+t*ax,a[1]+t*ay,ax,ay]:null;}
 for(const r of rivers){const stream=sample(r.points);for(const [ri,road]of roads.entries()){const lane=sample(road.p);for(let i=1;i<lane.length;i++)for(let j=1;j<stream.length;j++){const hit=intersect(lane[i-1],lane[i],stream[j-1],stream[j]);if(!hit)continue;const[x,y,dx,dy]=hit;if(inPoly(x,y,old))continue;
  if(additions.some(v=>Math.hypot(v.x-x,v.y-y)<30))continue;
  if(legacy.some(b=>{const a=px(b.a),c=px(b.b);return Math.hypot((a[0]+c[0])/2-x,(a[1]+c[1])/2-y)<38;}))continue;
  const horizontal=Math.abs(dx)>Math.abs(dy),w=horizontal?r.width*2.4:road.w+9,h=horizontal?road.w+9:r.width*2.4;
  const id=`river-crossing-${additions.length+1}`,[wx,wy]=at([x,y]);
  const source=readFileSync(`public/pixi-art/bridge-jetty-${horizontal?5:1}.svg`,'utf8');
  const vb=source.match(/viewBox="([^"]+)"/)[1];
  const art=source.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  writeFileSync(`${D}/${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${w/.18}" height="${h/.18}" viewBox="0 0 ${w/.18} ${h/.18}"><svg width="100%" height="100%" viewBox="${vb}" preserveAspectRatio="none">${art}</svg></svg>`);E.decks.push({id,src:`/pixi-art/home-communities/${id}.svg`,x:wx-w/.36,y:wy-h/.36,width:w/.18,height:h/.18,resolution:1.2});
  E.walkways.push({a:horizontal?[wx-w/.36,wy]:[wx,wy-h/.36],b:horizontal?[wx+w/.36,wy]:[wx,wy+h/.36],w:(horizontal?h:w)/.18});
  E.riverBridges.push({id,x:wx,y:wy,w:w/.18-18,h:h/.18-18});additions.push({id,river:r.id,road:ri,x,y,horizontal,width:w,height:h});
 }}}
 E.crossings=additions;
 E.arches=additions.map(c=>{const b=E.walkways.find(v=>{const p=px([(v.a[0]+v.b[0])/2,(v.a[1]+v.b[1])/2]);return Math.hypot(p[0]-c.x,p[1]-c.y)<1;});return {...b,r:48};});
 let g='';
 const outlines=[...polygons.map(r=>'M'+r.poly.map(p=>p.join(',')).join('L')+'Z'),curve(E.water.poly.map(px))];
 for(const d of outlines)g+=`<path d="${d}" fill="#6ec9de" stroke="#477f35" stroke-width="6" stroke-linejoin="round"/><path d="${d}" fill="#6ec9de" stroke="#d9cc86" stroke-width="2.3" stroke-linejoin="round"/>`;
 for(const d of outlines)g+=`<path d="${d}" fill="#6ec9de"/>`;
 for(const r of rivers){const a=sample(r.points);for(let i=3;i<a.length-3;i+=7){const[x,y]=a[i];g+=`<path d="M${x-3} ${y}q4-2 9 0" fill="none" stroke="#b3e5df" stroke-width="1"/>`;}}
 // Harvest strips and mown picnic greens articulate the remaining commons without filling them with solids.
 for(const[cx,cy,rx,ry]of [[132,476,104,83],[1430,750,105,92],[682,1163,118,42],[446,128,87,46],[1045,178,68,58],[40,938,67,55]])g+=`<path d="${curve([[cx-rx,cy],[cx-rx*.5,cy-ry],[cx+rx*.6,cy-ry*.8],[cx+rx,cy],[cx+rx*.4,cy+ry],[cx-rx*.65,cy+ry*.7]])}" fill="#b4cd4a" fill-opacity=".32" stroke="#7d9e3a" stroke-width="1" stroke-dasharray="3 6"/>`;
 for(const[x,y,len]of [[596,1144,128],[608,1156,133],[629,1170,126],[654,1185,105]])g+=`<path d="M${x} ${y}q${len/2} 9 ${len} -2" fill="none" stroke="#dfd075" stroke-width="4" stroke-linecap="round" stroke-dasharray="5 3 9 4"/>`;
 // Top-bank fishing shelf with stepping stones and lily pads, kept away from the bridge decks.
 for(const[x,y]of [[525,820],[566,831],[810,849],[941,971],[925,1009],[1348,414],[1277,454]])g+=`<ellipse cx="${x}" cy="${y}" rx="3.8" ry="2" fill="#dad3a4" stroke="#969068" stroke-width=".8"/>`;
 for(const[x,y]of [[568,824],[787,851],[944,958],[853,1149],[1378,399],[1267,460]])g+=`<path d="M${x-4} ${y}a5 2.7 0 1 0 5-2l-3 2Z" fill="#7ebd65" stroke="#477f35" stroke-width=".6"/>`;
 return g;
}
