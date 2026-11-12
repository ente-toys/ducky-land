import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';
import {bounds,coast,places,lanes,roadWidths,kit,sources} from './design.mjs';
import {render,OUT,A} from './render.mjs';
import {communities,houses,homeSVG,yardSVG} from './communities.mjs';
import {roadArt} from './roads.mjs';
import {waterways,waterArt,crossingArt,crossingCollision} from './water.mjs';
import {applyHamlets,hamletGroundArt,hamletMask} from './hamlets-apply.mjs';
const read=p=>JSON.parse(readFileSync(p)),save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,1)+'\n');
const old=read('scripts/bigger-sunflower/baseline/art.json'),world=read('scripts/bigger-sunflower/baseline/world.json'),walk=read('scripts/bigger-sunflower/baseline/walk-world.json'),art=structuredClone(old),D='assets/world/themes/sunflower/';
mkdirSync(A+'bigger',{recursive:true});
const line=points=>'M'+points.map(p=>p.join(' ')).join('L')+'Z';
function smooth(p,closed=false){let q=closed?[p.at(-1),...p,p[0],p[1]]:[p[0],...p,p.at(-1)];let d=`M${p[0].join(' ')}`;for(let i=1;i<q.length-2;i++){const[a,b,c,e]=q.slice(i-1,i+3);d+=`C${[b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6,c[0]-(e[0]-b[0])/6,c[1]-(e[1]-b[1])/6,...c].join(' ')}`}return d+(closed?'Z':'')}
const shape=line(coast),oldShape=line(world.coast),protectedShape=oldShape+world.islets.map(([x,y,rx,ry])=>line(Array.from({length:80},(_,i)=>[x+rx*Math.cos(i*Math.PI/40),y+ry*Math.sin(i*Math.PI/40)]))).join('');
const bufferedDryShape=line(world.coast.map(([x,y])=>{const dx=x-3880,dy=y-2608.5,r=Math.hypot(dx,dy);return [x+dx/r*160,y+dy/r*160]}))+world.islets.map(([x,y,rx,ry])=>line(Array.from({length:80},(_,i)=>[x+(rx+160)*Math.cos(i*Math.PI/40),y+(ry+160)*Math.sin(i*Math.PI/40)]))).join('');
let ground=`<defs><pattern id="grass" width="180" height="140" patternUnits="userSpaceOnUse"><path d="M22 32l4 -9 3 10m-7 -1l-5 -5 M110 112l3 -10 5 11m-4 -1l6 -5 M142 42l2 -6 3 6" stroke="#648E2E" stroke-width="2.5" fill="none" opacity=".55"/><ellipse cx="62" cy="98" rx="7" ry="2" fill="#B7CD52"/><ellipse cx="151" cy="90" rx="3" ry="1.5" fill="#E4D279"/><path d="M77 18l13 2" stroke="#AFCA49" stroke-width="3" opacity=".45"/></pattern><clipPath id="new-land"><path d="${shape}"/></clipPath><mask id="outside-original" x="-2000" y="-1400" width="12000" height="8400" maskUnits="userSpaceOnUse"><rect x="-2000" y="-1400" width="12000" height="8400" fill="white"/><path d="${protectedShape}" fill="black" stroke="black" stroke-width="64"/></mask></defs>`;
ground+=`<g mask="url(#outside-original)"><path d="${shape}" fill="#E9CE79" stroke="#FFF0C7" stroke-width="18"/><g clip-path="url(#new-land)"><path d="${shape}" fill="#93B72F" stroke="#FDE48C" stroke-width="320"/><path d="${shape}" fill="url(#grass)"/>`;
// Large authored tonal fields give walking space contours rather than blank green.
for(const [x,y,rx,ry,c] of [[1300,200,1500,680,'#A5BF3E'],[4000,-180,1600,570,'#A6BD37'],[7200,450,1400,750,'#9FB935'],[8450,2600,660,1350,'#A7C344'],[7900,4350,1000,720,'#A3BC38'],[4800,5660,1800,700,'#A7BF41'],[1500,5300,1600,740,'#9DBB38'],[-400,2800,800,1600,'#A4C045']])ground+=`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" opacity=".5"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#grass)"/>`;
ground+='<g mask="url(#outside-original)">';
// Named working commons are composed surfaces, with generous clear walking gaps.
for(const [x,y,w,h] of [[4600,-420,870,290],[1260,5300,860,340],[7080,4860,950,470],[-200,4470,650,330]])ground+=`<path d="M${x-w/2} ${y}q${w*.18} ${-h*.7} ${w*.5} ${-h*.46}t${w*.5} ${h*.46}q${-w*.18} ${h*.7} ${-w*.5} ${h*.46}t${-w*.5} ${-h*.46}Z" fill="#B2C75A" stroke="#7F9E3C" stroke-width="5"/><path d="M${x-w*.3} ${y-40}q${w*.3} -20 ${w*.6} 0m${-w*.6} 65q${w*.3} -20 ${w*.6} 0" fill="none" stroke="#8CAA43" stroke-width="15" opacity=".5"/>`;
// Each square remains at its established address, with a grass gathering green
// rather than a broad sand slab. Household gardens meet along the short lanes.
for(const c of communities){const[x,y,w,h]=c.green;ground+=`<path d="M${x-w*.5} ${y}q${w*.1} ${-h*.6} ${w*.5} ${-h*.48}t${w*.5} ${h*.48}q${-w*.1} ${h*.6} ${-w*.5} ${h*.48}t${-w*.5} ${-h*.48}Z" fill="#B8C963" stroke="#7C9C3D" stroke-width="5"/><path d="M${x-w*.5} ${y}q${w*.1} ${-h*.6} ${w*.5} ${-h*.48}t${w*.5} ${h*.48}q${-w*.1} ${h*.6} ${-w*.5} ${h*.48}t${-w*.5} ${-h*.48}Z" fill="url(#grass)"/>`;}
ground+=roadArt(lanes,communities,houses);
// boss 8 Nov: the GPT hamlets' squares and lanes, in the centre's path style, over the road ends that join them
ground+=`<defs>${hamletMask(shape)}</defs>${hamletGroundArt()}`;
for(const h of houses){const body=yardSVG(h).replace(/^.*?<svg[^>]*>/s,'').replace('</svg>','');ground+=`<g transform="translate(${h.x-255} ${h.y-145})">${body}</g>`;}
ground+=waterArt();
ground+='</g></g></g>';
for(const b of waterways.bridges){const p=crossingArt(b,protectedShape),src=`bigger/${b.id}.svg`;writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" viewBox="${p.x} ${p.y} ${p.width} ${p.height}">${p.body}</svg>`);art.decks.push({src,x:p.x,y:p.y,width:p.width,height:p.height});}
const newProps=[],obstacles=[];
function asset(id,name,src,x,y,scale=1,foot=null){const base=old.props.find(p=>p.src===src);if(!base)throw Error(src);const p={...base,id:`bigger-${id}`,name,src,x,y,scale,wind:/Tree|Sunflower/.test(name)};delete p.centrePiece;newProps.push(p);if(foot){const o={name:p.id,x,y:y-(foot[2]??8),rx:foot[0],ry:foot[1]};obstacles.push(o)}return p;}
const footprints={barn:[210,58,50],windmill:[145,50,28],hay:[65,24,8],haystack:[70,29,8],barrel:[22,16,4],cart:[90,32,16],honey:[170,46,12],flowers:[170,46,12],planter:[38,18,7],sun:[24,14,8],fence:[100,10,6],arch:null,picnic:null,table:[110,32,10],bench:[70,16,8],lamp:[14,10,5],tree3:[31,22,9],tree4:[28,19,9]};
for(const [i,[zone,kind,x,y,scale]]of kit.entries()){const adjusted=scale*({hay:.48,haystack:.44,barrel:.46,planter:.45,sun:.5,fence:.37,arch:.716,picnic:.38}[kind]??1),f=footprints[kind],rat=['barn','windmill','honey','flowers'].includes(kind)?scale/(kind==='barn'?1.236:kind==='windmill'?1.384:.788):1;asset(`${zone}-${i}`,kind.startsWith('tree')?'Tree':kind==='sun'?'Sunflower':kind,sources[kind],x+(zone==='nursery'?450:0),y+(zone==='nursery'?30:0),adjusted,f?.map((n,j)=>j<2?n*rat:n));}
// Use the original arch's separated solid feet, keeping its opening walkable.
for(const p of newProps.filter(p=>p.name==='arch'))for(const dx of [-118,118])obstacles.push({name:p.id,x:p.x+dx,y:p.y-25,rx:24,ry:19});
// Theme-specific new pieces, drawn with Sunbob's ink, yellow timber, and green foliage.
function custom(id,name,x,y,w,h,body,foot){const src=`bigger/${id}.svg`;writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="#39472D" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`);newProps.push({id:'bigger-'+id,name,src,x,y,width:w,height:h,anchor:{x:.5,y:1},scale:1,resolution:1.5});if(foot)obstacles.push({name:'bigger-'+id,x,y:y-12,rx:foot[0],ry:foot[1]});}
// Every house is an authored address, with an open porch and gate.
for(const h of houses){
 const src=`bigger/${h.id}.svg`;writeFileSync(A+src,homeSVG(h));
 newProps.push({id:h.id,name:communities.find(c=>c.id===h.community).name+' cottage '+h.address,src,x:h.x,y:h.y,width:360*h.sx,height:312*h.sy,scale:1,anchor:{x:.5,y:1},resolution:1.5});
 obstacles.push({name:h.id,x:h.x,y:h.y-40,rx:124,ry:30,poly:[[h.x-123*h.sx,h.y-63],[h.x+123*h.sx,h.y-63],[h.x+123*h.sx,h.y-24],[h.x,h.y-15],[h.x-123*h.sx,h.y-24]]});
 // Low front rails and mailbox are drawn into each yard. The gate stays clear.
 for(const [dx,rx]of [[-146,89],[139,88]])obstacles.push({name:h.id+'-front-fence',x:h.x+dx,y:h.y+183,rx,ry:8,poly:[[h.x+dx-rx,h.y+175],[h.x+dx+rx,h.y+175],[h.x+dx+rx,h.y+191],[h.x+dx-rx,h.y+191]]});
}
// A shared pump, bucket and low sitting wall anchor each neighbourhood green.
// These are fixed compositions beside the passage, never at the gate or spawn.
for(const [id,x,y]of [['pollenpatch',1710,470],['hayhello',6410,330],['whirlyseed',8930,3090],['petalpost',3810,5820],['seedwake',-780,3220]]){
 custom('pump-'+id,'Shared well at '+id,x,y,148,130,`<ellipse cx="74" cy="116" rx="70" ry="11" fill="#8DAB45" stroke="none"/><path d="M16 97Q74 74 132 97V112Q74 133 16 112Z" fill="#C9B785"/><ellipse cx="74" cy="96" rx="58" ry="16" fill="#E9D6A4"/><path d="M68 92V41Q68 29 80 29H88V44H82V92Z" fill="#6D9670"/><path d="M72 40L48 21L29 30M29 30L23 54" fill="none" stroke="#566E47" stroke-width="7"/><path d="M83 59H111V73H102V67H83" fill="#7CA37A"/><path d="M102 87L124 87L121 105H105Z" fill="#BA8D4F"/><path d="M105 88Q113 72 122 88" fill="none"/>`,[42,14]);
}
const flower=(x,y)=>`<path d="M${x} ${y+24}v-25m0 17l-13 -8m13 3l12 -9" stroke="#568338" stroke-width="4"/><g fill="#F9CA35"><ellipse cx="${x}" cy="${y}" rx="17" ry="8"/><ellipse cx="${x}" cy="${y}" rx="8" ry="17"/></g><circle cx="${x}" cy="${y}" r="7" fill="#8F6336"/>`;
for(const [i,x,y]of [[1,2950,70],[2,3120,100],[3,3280,90]])custom('hive-'+i,'Pollenpatch apiary',x,y,140,145,`<ellipse cx="70" cy="132" rx="65" ry="12" fill="#72943B" stroke="none"/><path d="M24 120V60Q70 15 116 60V120Z" fill="#E8B951"/><path d="M25 77H115M24 97H116M43 54Q70 43 96 54" fill="none"/><ellipse cx="70" cy="108" rx="12" ry="8" fill="#39472D"/><path d="M14 122H126V136H14Z" fill="#C28D49"/>`,[52,20]);
for(const [i,x,y]of [[1,350,700],[2,530,540]])custom('coldframe-'+i,'Pollenpatch seedling frame',x,y,270,150,`<path d="M12 76L70 25H255L242 104Z" fill="#B7D990"/><path d="M12 76V125L242 146V104Z" fill="#D4A35D"/><path d="M70 25L68 81M130 25L126 88M190 25L184 96M12 76L242 104M68 81L255 25" fill="none" stroke="#FFF0C7" stroke-width="5"/><path d="M40 76q10 -25 22 0m40 5q10 -26 22 0m40 9q10 -27 22 0" stroke="#4B8B38" stroke-width="8" fill="none"/>`,[121,38]);
function workplace(id,label,x,y,roof,activity){
 custom(id,label,x,y,420,350,`<ellipse cx="210" cy="332" rx="198" ry="14" fill="#6E8F39" opacity=".35" stroke="none"/><path d="M46 141V315Q210 337 374 315V141Z" fill="#EBC77D"/><path d="M46 282Q210 301 374 282V315Q210 337 46 315Z" fill="#C6AD71"/><path d="M22 145L86 41H333L399 145L372 161H48Z" fill="${roof}"/><path d="M46 147H375M77 117H347M95 84H326" stroke="#EAC37E" fill="none"/><path d="M65 187H355V229H65Z" fill="#FFF0C7"/><text x="210" y="213" font-family="sans-serif" font-size="21" text-anchor="middle" fill="#6A603B" stroke="none">${label}</text><path d="M150 316V245H269V316" fill="#A27742"/><path d="M209 246V318M156 272H263M156 294H263" stroke="#DDB877"/><rect x="70" y="245" width="56" height="50" rx="6" fill="#A9C78A"/><path d="M98 245V295M70 270H126" stroke="#FFF0C7" stroke-width="4"/>${flower(322,275)}<path d="M285 305H358V318H285Z" fill="#C28E4E"/>${activity}`, [165,37]);
}
workplace('seed-store','SEED LIBRARY',3550,190,'#7D984C','');
workplace('harvest-store','HARVEST CO-OP',5310,-80,'#B66D45','<path d="M300 67V11H325V95" fill="#D6BD86"/>');
workplace('bakery','SUNCRUMB BAKERY',8990,2360,'#CC8F44','<path d="M298 69V7H332V105" fill="#D6BD86"/><path d="M290 6H340V22H290Z" fill="#C0A16D"/>');
workplace('flower-room','PETAL PACKING',5370,5930,'#BF7257','');
workplace('sail-loft','SEEDWAKE LOFT',-770,2050,'#759966','<path d="M112 126L210 52L309 126Z" fill="#FFF0C7"/><path d="M210 53V123" fill="none"/>');
custom('bread-oven','Whirlyseed shared oven',8000,3180,230,240,`<path d="M30 207V109Q115 20 200 109V207Z" fill="#D1AF70"/><path d="M18 207H212V230H18Z" fill="#AD8B54"/><path d="M83 207V160Q115 124 147 160V207Z" fill="#79613D"/><path d="M55 102Q115 70 178 102M36 132H194M30 169H78M155 169H198M115 72V99" fill="none" stroke="#A88A54"/><path d="M139 72V23H169V97" fill="#D9C18C"/><path d="M131 22H178V36H131Z" fill="#BBA16B"/><path d="M92 201Q95 177 109 188Q120 159 134 199Z" fill="#EBA64A"/>`,[90,25]);
for(const [id,x,y,kind]of [['honey-table',2310,730,'honey'],['hay-table',6550,570,'seeds'],['bread-table',9180,3220,'bread'],['bouquet-table',4260,6160,'flowers'],['net-table',-940,3550,'nets']]){
 let wares=kind==='nets'?'<path d="M54 49L185 65L161 105L32 87Z" fill="#C4C99A"/><path d="M52 58L176 80M44 72L166 93M65 53L51 89M94 55L80 92M125 58L111 98M154 62L139 101" stroke="#65835D" fill="none"/>':kind==='flowers'?flower(83,68)+flower(130,58)+flower(175,74):kind==='bread'?'<g fill="#D7A257"><ellipse cx="75" cy="66" rx="34" ry="19"/><ellipse cx="145" cy="75" rx="34" ry="19"/></g><path d="M61 57l10 15m67 -7l10 16" stroke="#FFF0C7"/>':'<g fill="#E8BD5D"><rect x="54" y="45" width="33" height="43" rx="7"/><rect x="102" y="42" width="33" height="46" rx="7"/><rect x="150" y="49" width="33" height="43" rx="7"/></g><path d="M55 50H87M103 47H134M151 54H183" stroke="#886D3B" stroke-width="8"/>';
 custom(id,kind+' communal workbench',x,y,240,170,`<path d="M32 96V161M209 99V161" stroke="#8E663B" stroke-width="10"/><path d="M10 67L49 36H227L230 112L12 102Z" fill="#D5A15E"/><path d="M18 91L224 101M40 70L213 80" fill="none" stroke="#AA7C43"/>${wares}`,[104,25]);
}
// Cultivated fields belong to named households and workplaces, with walking gaps.
for(const [zone,cx,cy,rows]of [['pollenpatch',2230,910,2],['hayhello',7600,980,4],['whirlyseed',7880,2110,3],['petalpost',4600,6400,2]])for(let i=0;i<rows;i++)asset(`${zone}-row-${i}`,'Sunflower row','detail/field-row-short.svg',cx,cy+i*90,.49,[135,16,4]);
for(const [zone,x,y]of [['pollenpatch',3750,430],['hayhello',8150,1400],['petalpost',5700,6210]])for(const [i,[dx,dy]]of [[-170,-30],[125,-30],[-170,70],[125,70]].entries())asset(zone+'-plot-'+i,'Sunflower row','detail/field-row-short.svg',x+dx,y+dy,.47,[132,16,5]);
// Four commons and the brook pond, each with explicitly placed furnishings.
for(const [id,kind,x,y,scale] of [
 ['orchard-1','tree4',4500,-330,1.05],['orchard-2','tree3',4810,-390,1.12],['orchard-3','tree4',5120,-310,1],
 ['orchard-table','table',4750,-100,.23],['orchard-cart','cart',5300,-230,.33],
 ['clover-tree','tree4',960,5200,1.15],['clover-tree-2','tree3',1460,5150,1],['clover-table','table',1250,5480,.25],['clover-planter','planter',1540,5490,.4],
 ['seed-meadow-tree','tree3',6800,4820,1.1],['seed-meadow-tree-2','tree4',7350,4740,1.05],['seed-meadow-table','table',7100,5110,.25],['seed-meadow-bench','bench',7480,5070,.18],
 ['west-grove-1','tree4',-330,4450,1.1],['west-grove-2','tree3',-20,4580,1.05],['west-grove-bench','bench',-250,4700,.18],
 ['pond-bench','bench',350,1770,.18]
])asset(id,id.includes('tree')||id.startsWith('orchard-')&&kind.startsWith('tree')?'Tree':kind,sources[kind],x,y,scale,footprints[kind]);
for(const [id,src,x,y,scale]of [
 ['pond-reeds-1','reuse/reeds.svg',150,1580,1.25],['pond-reeds-2','reuse/reeds.svg',440,1530,1.05],
 ['brook-reeds','reuse/reeds.svg',4140,480,1.15],['canal-reeds','reuse/cattails.svg',3670,4740,1],
 ['pond-lily','reuse/lily-pad-flower.svg',280,1490,.7],['pond-rock','reuse/rock-round.svg',60,1640,.6]
]){const text=readFileSync(A+src,'utf8'),vb=text.match(/viewBox="([^"]+)"/)[1].split(/[ ,]+/).map(Number);newProps.push({id:'bigger-'+id,name:id,src,x,y,width:vb[2],height:vb[3],scale:scale*.15,anchor:{x:.5,y:1},resolution:1});}
for(const [zone,cx,cy]of [['clover',1390,5350],['seed-meadow',7090,4840],['pollen-garden',820,600],['hay-croft',5870,480],['miller-garden',8700,4020],['petal-cuttings',4530,5760],['wharf-kitchen',-1100,4100]])for(const [i,dy]of [-70,10,90].entries())asset(`${zone}-bed-${i}`,'Sunflower row','detail/field-row-short.svg',cx,cy+dy,.42,[115,16,4]);
// Verge furnishings are fixed compositions at particular corners and junctions.
const corners=[[500,1250],[2690,640],[3370,340],[5960,420],[8050,1080],[7800,1340],[8240,2470],[8710,3680],[8020,4100],[2850,5900],[4320,6400],[4780,6150],[-960,3850],[-280,2920],[-480,4400]];
for(const [i,[x,y]]of corners.entries()){asset('corner-flower-'+i,'Flowers','reuse/flower-2.svg',x,y,2.3,null);asset('corner-bush-'+i,'Bush','reuse/bush-1.svg',x-70,y-30,.85,[27,14,5]);}
for(const [i,[x,y,kind]]of [[-500,850,'tree3'],[-800,1420,'tree4'],[-1150,2450,'tree3'],[-100,1200,'tree4'],[400,1770,'tree3'],[3070,-200,'tree4'],[4050,-350,'tree3'],[4480,-340,'tree4'],[4980,-250,'tree3'],[5340,-100,'tree4'],[8110,820,'tree3'],[8700,1210,'tree4'],[9300,2420,'tree3'],[9090,3950,'tree4'],[7700,5140,'tree3'],[6800,5640,'tree4'],[6390,5830,'tree3'],[4050,6430,'tree4'],[2760,6240,'tree3'],[2620,5850,'tree4'],[370,4830,'tree3'],[-120,4330,'tree4']].entries())asset('shelter-'+i,'Tree',sources[kind],x,y,1.15,[30,20,8]);
for(const [i,c]of communities.entries()){
 const [x,cy]=c.point,y=cy-(c.id==='hayhello'?250:0);custom('sign-'+c.id,c.name+' sign',x+(c.id==='seedwake'?-710:290),y+(c.id==='seedwake'?-400:140),140,150,`<path d="M70 62V143" stroke="#92703F" stroke-width="12"/><path d="M9 23Q70 12 131 23L126 86Q70 93 14 84Z" fill="#D9B36B"/><path d="M17 30L123 29" stroke="#F7DFA0"/><text x="70" y="51" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#655331" stroke="none">${c.name.split(' ')[0]}</text><path d="M35 69H102m-8 -7l9 7 -9 7" fill="none"/>`,[15,10]);
}
// boss 8 Nov: the five communities are GPT's hamlets (hamlets.json); their old cottages, kit and workshops are cleared
const hamletReport=applyHamlets({newProps,obstacles,world});
const extensionTiles=[];
for(let row=0;row<6;row++)for(let col=0;col<8;col++){const x=bounds.origin.x+col*1500,y=bounds.origin.y+row*1400,src=`bigger/ground-${row}-${col}.svg`;writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="700" viewBox="${x} ${y} 1500 1400">${ground}</svg>`);extensionTiles.push({src,x,y,width:1500,height:1400,resolution:1});}
// Keep original SVGs untouched. Derivatives omit only exterior water rings and foam.
// No path, dry shoreline, field, ground texture or inner water element is redrawn.
const originalTiles=[];
for(const [i,t]of old.ground.tiles.entries()){
 const svg=readFileSync(A+t.src,'utf8'),end=svg.indexOf('</defs>')+7;
 const head=svg.slice(0,end).replace('</defs>',`<clipPath id="preserved-dry-shore"><path d="${oldShape}"/><path d="${bufferedDryShape}" fill="white" stroke="white" stroke-width="48"/></clipPath></defs>`),rest=svg.slice(end);let pathCount=0;
 const clean=rest.replace(/<path\b[^>]*\/>/g,s=>{pathCount++;if(pathCount>3&&pathCount<=6)return `<g clip-path="url(#original-terrain-only)">${s}</g>`;return pathCount>6&&(/stroke="#FFF0C7"/.test(s)&&/stroke-opacity="\.45"/.test(s))?`<g clip-path="url(#preserved-dry-shore)">${s}</g>`:s});
 const src=`bigger/original-ground-${i}.svg`;writeFileSync(A+src,head.replace('</defs>',`<clipPath id="original-terrain-only"><path d="${waterways.originalClipPath}"/></clipPath></defs>`)+clean);originalTiles.push({...t,src});
}
art.width=bounds.width;art.height=bounds.height;art.origin=bounds.origin;art.ground.tiles=[...extensionTiles,...originalTiles];art.props.push(...newProps);
// Draw first: the fixed production kit is also the drawing vocabulary. Labels are proof-only.
if(!process.argv.includes('--build')){
 await render(art,OUT+'/sunflower-work/design-base.png');
 const annotations=places.map(p=>`<text x="${(p.x+2000)*.14}" y="${(p.y+1400)*.14+105}" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#39472D" stroke="#FFF3D2" stroke-width="5" paint-order="stroke">${p.name}</text>`).join('');
 await sharp(OUT+'/sunflower-work/design-base.png').composite([{input:Buffer.from(`<svg width="1680" height="1176">${annotations}<text x="35" y="45" font-family="Arial" font-size="25" fill="#39472D">SUNBOB FIELDS / communities</text><text x="35" y="75" font-family="Arial" font-size="17" fill="#39472D">Original heart unchanged. Five working neighbourhoods, family gardens and worn sandy lanes.</text></svg>`)}]).png().toFile(OUT+'/sunflower-communities.png');
 console.log('Drawing saved before data build');
}else{
 Object.assign(world,bounds,{coast,props:art.props,surfIslets:[]});Object.assign(walk,bounds,{coast});
 world.obstacles.push(...obstacles);walk.obstacles.push(...obstacles);
 const crossings=[...waterways.originalCrossings,...waterways.bridges].flatMap(crossingCollision);
 for(const m of [world,walk]){m.water.push(...waterways.water);m.bridges.push(...crossings);}

 for(const p of places)world.zones['bigger-'+p.id]={...p,spawn:p.point};
 world.paths.push(...lanes);world.pathWidths.push(...roadWidths);
 const harbor=read('scripts/bigger-sunflower/baseline/harbor.json');harbor.jetty={foot:[-1340,3480],tip:[-2040,3480],width:130};   // boss 8 Nov: south of the Seedwake seed shed, touching no buildingharbor.water={x:-2100,y:3130};
 harbor.boats=[{x:-2120,y:3240,turn:Math.PI/2},{x:-2100,y:3680,turn:Math.PI/2},{x:-1760,y:3260,turn:Math.PI/2}];   // boss 8 Nov: moored at the moved pier
 // Other moorings are chosen along the new coast normals. These are boat positions, never scenery.
 for(const i of [8,30,57,83,104,134,157]){const p=coast[i],dx=p[0]-4000,dy=p[1]-2800,len=Math.hypot(dx,dy);harbor.boats.push({x:Math.round(p[0]+dx/len*110),y:Math.round(p[1]+dy/len*110),turn:Math.atan2(dx,-dy)})}
 // A new drawn pier matches the interactive harbour; the original decorative piers remain in place.
 writeFileSync(A+'bigger/landing-pier.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="780" height="170" viewBox="0 0 780 170"><path d="M10 22H770V148H10Z" fill="#C98F4D" stroke="#6D5535" stroke-width="4"/>${Array.from({length:39},(_,i)=>`<path d="M${20+i*19} 24V147" stroke="#9B6C37" stroke-width="2"/>`).join('')}<path d="M10 32H770M10 137H770" stroke="#E1B268" stroke-width="6"/><path d="M18 12V160M752 12V160" stroke="#6D5535" stroke-width="13"/></svg>`);
 art.decks.push({src:'bigger/landing-pier.svg',x:-2080,y:3395,width:780,height:170});
 save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'harbor.json',harbor);
 save(D+'bigger-sunflower.json',{bounds,places,communities:communities.map(c=>({...c,homes:houses.filter(h=>h.community===c.id),hamlet:hamletReport[c.id]})),lanes,newProps:newProps.length,newObstacles:obstacles.length,oldProps:old.props.length,originalTiles:old.ground.tiles.length});console.log('Built five working communities',newProps.length,'new props');
}
