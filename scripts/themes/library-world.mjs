import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {libraryArcBenches} from './library-arc-benches.mjs';
import {libraryCourtPaving,libraryCloseupFurniture,libraryPathInlays} from './library-closeup-detail.mjs';
import {geometry,inPoly,inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const ART='public/pixi-art/themes/library/', DATA='assets/world/themes/library/';
const W=8000, HH=5600, S=4.8, r1=v=>Math.round(v*10)/10;
const T=([x,y])=>[r1(300+x*4.8),r1(200+y*5.2)];
const TS=v=>v*S;
function catmull(pts, closed, n = 10) {
  const out = [], N = pts.length, P = i => pts[closed ? (i + N) % N : Math.max(0, Math.min(N - 1, i))];
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if (!closed) out.push(pts[N - 1]);
  return out.map(([x, y]) => [r1(x), r1(y)]);
}
const area = p => p.reduce((s, a, i) => {const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1];}, 0) / 2;
function offset(p, d) {
  const sgn = area(p) > 0 ? 1 : -1, N = p.length;
  return p.map((a, i) => {
    const pr = p[(i - 1 + N) % N], nx = p[(i + 1) % N], tx = nx[0] - pr[0], ty = nx[1] - pr[1], l = Math.hypot(tx, ty) || 1;
    return [r1(a[0] - sgn * ty / l * d), r1(a[1] + sgn * tx / l * d)];
  });
}
function strip(line, w) {
  const L = [], R = [];
  line.forEach((a, i) => {
    const pr = line[Math.max(0, i - 1)], nx = line[Math.min(line.length - 1, i + 1)], tx = nx[0] - pr[0], ty = nx[1] - pr[1], l = Math.hypot(tx, ty) || 1;
    L.push([r1(a[0] - ty / l * w / 2), r1(a[1] + tx / l * w / 2)]); R.push([r1(a[0] + ty / l * w / 2), r1(a[1] - tx / l * w / 2)]);
  });
  return [...L, ...R.reverse()];
}
const d = p => 'M' + p.map(([x, y]) => `${x} ${y}`).join(' L') ;
const dz = p => d(p) + ' Z';
const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
const lineDist = (x, y, l) => Math.min(...l.slice(1).map((b, i) => segDist(x, y, l[i], b)));
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);


const LEFT_C=[[695,385],[725,320],[780,260],[768,210],[740,165],[752,120],[710,85],[630,65],[550,62],[465,90],[380,68],[295,67],[210,70],[140,100],[130,160],[95,220],[50,275],[38,330],[68,390],[45,455],[42,520],[65,590],[45,660],[58,720],[47,780],[88,835],[115,885],[205,902],[300,935],[390,920],[480,931],[565,912],[645,910],[680,865],[668,810],[688,765],[704,725],[700,670],[685,625],[713,575],[739,530],[744,480],[718,435]];
const RIGHT_C=[[835,385],[840,440],[870,485],[858,535],[820,585],[800,630],[830,680],[820,730],[780,795],[775,850],[770,900],[825,927],[900,940],[995,920],[1075,925],[1170,897],[1270,905],[1360,875],[1430,860],[1480,815],[1470,755],[1490,690],[1474,630],[1495,565],[1478,500],[1490,440],[1470,375],[1480,310],[1460,245],[1410,195],[1405,135],[1380,90],[1305,72],[1220,90],[1135,70],[1050,61],[960,82],[895,110],[850,150],[834,200],[850,255],[825,310]];
let rings=[catmull(LEFT_C.map(T),true,7),catmull(RIGHT_C.map(T),true,7)];
rings=rings.map(p=>area(p)>0?p:[p[0],...p.slice(1).reverse()]);
const joinRings=([a,b])=>[...a,a[0],...b,b[0],a[0]];
const EDGE=joinRings(rings), WALK_COAST=joinRings(rings.map(p=>offset(p,35)));
const GRASSES=rings.map(p=>offset(p,90));
const land=(x,y,pad=0)=>rings.some(p=>inPoly(x,y,pad?offset(p,pad):p));
const C={ink:'#39472D',grass:'#93B72F',grassShade:'#87B431',grassDeep:'#7DAE30',sand:'#FDE48C',sandShade:'#E4C567',water:'#6EC9DE',waterHi:'#B5E7F7',halo:'#8FD6E6',pave:'#F7E6AF',paveLine:'#E2CC8C'};
const PC=[
 [[125,155],[210,200],[185,290],[220,360],[270,410]],
 [[62,505],[150,485],[245,480]],
 [[440,625],[560,665],[650,735],[700,730],[830,730],[980,680],[1010,665]],
 [[130,875],[190,840],[330,865],[500,860],[620,805],[650,735]],
 [[695,385],[760,385],[835,385],[940,380]],
 [[690,385],[630,400]],
 [[1395,150],[1375,195],[1400,280],[1380,310]],
 [[1160,475],[1195,540],[1195,570]],
 [[1390,390],[1440,415],[1460,505],[1435,610],[1410,675]],
 [[1040,780],[1120,825],[1230,810],[1340,855]],
 [[915,615],[955,640],[1010,665]],
 [[175,585],[200,650],[175,740],[190,840]],
 [[1010,665],[1000,745],[1040,780]],
];
const PATHS=PC.map((p,i)=>({line:catmull(p.map(T),false,8),w:[2,4,7,8,12].includes(i)?240:190}));
const oval=(c)=>({x:T(c)[0],y:T(c)[1],rx:c[2]*4.8,ry:c[3]*5.2});
const ACT=[{id:'activity-1',name:'Readers green',...oval([360,745,125,75]),kind:'lawn'},
 {id:'activity-2',name:'Story lawn',...oval([590,145,90,45]),kind:'lawn'},
 {id:'activity-3',name:'Pagepond open square',...oval([1210,665,195,93]),kind:'paved'}];
const STALL_ROWS=[{id:'stalls-1',name:'West book fair row',...oval([325,838,105,20])},
 {id:'stalls-2',name:'Canal market row',...oval([950,760,65,20])},
 {id:'stalls-3',name:'East square stall row',...oval([1210,790,100,20])}];
const POND=oval([915,565,72,40]);
const BEACH=catmull([[1055,835],[1150,805],[1240,825],[1350,795],[1455,790],[1485,900],[1350,960],[1110,965],[980,935],[990,890]].map(T),true,8);
const water=[POND],walkways=[],arches=[],bridges=[],decks=[],props=[],obstacles=[],flats=[],floating=[];
const islets=[];let pid=0;
const ASSET = {};
function asset(name, src, w, h, ay = 1) {ASSET[name] = {src, w, h, ax: .5, ay};}
const svgSize = f => {const s = readFileSync(f, 'utf8').slice(0, 600), m = s.match(/viewBox="([\d.\s-]+)"/); const v = m[1].trim().split(/\s+/).map(Number); return [v[2], v[3]];};
for (const n of ['hall', 'tower-1', 'tower-2', 'tower-3', 'tower-4', 'pencil-lamp', 'inkwell-planter', 'reading-cushion', 'shelf-arch', 'book-stall-red', 'book-stall-blue', 'book-pile', 'open-book', 'book-bench', 'book-slide', 'toy-blocks', 'book-climber', 'block-steps', 'lantern-tree']) {
  const [w, h] = svgSize(ART + n + '.svg'); asset(n, n + '.svg', w, h, (h - 6) / h);
}
const REUSE = {plants: ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'tree-5', 'bush-1', 'bush-2', 'bush-3', 'bush-4', 'bush-5', 'bush-6', 'flower-1', 'flower-2', 'flower-3'],
  detail: ['street--bench-wood', 'street--bench-park', 'street--umbrella-garden', 'street--umbrella-cafe', 'beach--towel-striped', 'beach--towel-sun', 'beach--beach-ball',
    'beach--shell-scallop', 'beach--starfish-orange', 'beach--sandcastle-small', 'beach--bucket', 'nature--reeds', 'nature--cattails', 'nature--lily-pad-flower', 'nature--lily-pad-large',
    'nature--rock-round', 'nature--rock-boulder', 'street--picnic-blanket', 'street--planter-flowers', 'street--signpost-three-way'],
  decals: ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'pebble-1', 'pebble-2', 'sand-speck-1', 'sand-speck-2']};
const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
for (const [dir, list] of Object.entries(REUSE)) for (const n of list) {
  copyFileSync(`public/pixi-art/${dir}/${n}.svg`, `${ART}reuse/${n}.svg`);
  const key = n.includes('--') ? n.split('--')[1] : n;
  if (dir === 'detail') {const a = manifest.assets.find(x => x.name === key); asset(key, `reuse/${n}.svg`, a.size.width, a.size.height, a.anchor.y / a.size.height);}
  else {const [w, h] = svgSize(`public/pixi-art/${dir}/${n}.svg`); asset(key, `reuse/${n}.svg`, w, h, 1);}
}
const SCALE = {'book-slide': .63, 'toy-blocks': .47, 'book-climber': .78, 'block-steps': .45, 'lantern-tree': .74, hall: .78, 'tower-1': .8, 'tower-2': .78, 'tower-3': .66, 'tower-4': .76, 'pencil-lamp': .44, 'inkwell-planter': .32, 'reading-cushion': .46,
  'shelf-arch': .74, 'book-stall-red': 1.25, 'book-stall-blue': 1.25, 'book-pile': .62, 'open-book': .6, 'book-bench': .62,
  tree: 1.265, bush: 1.3, flower: 1.6, 'bench-wood': .18, 'bench-park': .18, 'umbrella-garden': .29, 'umbrella-cafe': .29, 'towel-striped': .26, 'towel-sun': .26,
  'beach-ball': .2, 'shell-scallop': .19, 'starfish-orange': .19, 'sandcastle-small': .24, bucket: .17, reeds: .24, cattails: .24, 'lily-pad-flower': .2, 'lily-pad-large': .2,
  'rock-round': .2, 'rock-boulder': .17, 'picnic-blanket': .3, 'planter-flowers': .17, 'signpost-three-way':.18};
const FOOT = {hall: 'hall', 'shelf-arch': 'arch', 'reading-cushion': 'low', 'open-book': 'none', 'towel-striped': 'none', 'towel-sun': 'none', 'picnic-blanket': 'none',
  'lily-pad-flower': 'none', 'lily-pad-large': 'none', 'shell-scallop': 'none', 'starfish-orange': 'none', 'beach-ball': 'low', reeds: 'none', cattails: 'none', flower: 'none', 'umbrella-garden': 'pole', 'umbrella-cafe': 'pole'};
const kindOf0 = n => /^tree-/.test(n) ? 'tree' : /^bush-/.test(n) ? 'bush' : /^flower-/.test(n) ? 'flower' : n;
const kindOf = n => n === 'lantern-tree' ? 'lantern-tree' : kindOf0(n);
const NICE = {hall: 'Grand Reading Hall', 'tower-1': 'Book tower', 'tower-2': 'Book tower', 'tower-3': 'Book tower', 'tower-4': 'Book tower', 'pencil-lamp': 'Pencil lamp', 'inkwell-planter': 'Inkwell planter',
  'reading-cushion': 'Reading cushions', 'shelf-arch': 'Shelf arch', 'book-stall-red': 'Book stall', 'book-stall-blue': 'Book stall', 'book-pile': 'Book pile', 'open-book': 'Open book', 'book-bench': 'Reading bench', 'book-slide': 'Book slide', 'toy-blocks': 'Toy blocks', 'book-climber': 'Book climbing frame', 'block-steps': 'Block steps', 'lantern-tree': 'Story tree'};
function put(name,cp,zone='',{world=false,mult=1,flip=false}={}){
 const [x,y]=world?cp:T(cp),a=ASSET[name],k=kindOf(name),s=(SCALE[k]??1)*mult,w=a.w*s,h=a.h*s;
 const p={id:`lib-${pid++}`,name:NICE[name]||name,asset:name,src:a.src,x:r1(x),y:r1(y),width:a.w,height:a.h,anchor:{x:.5,y:a.ay},scale:s,flip,zone};props.push(p);
 const f=k==='lantern-tree'?'trunk':FOOT[k]??(k==='tree'?'trunk':k==='bush'?'bush':'base');
 if(f==='trunk')obstacles.push({x,y:y-9,rx:31,ry:22});
 else if(f==='bush')obstacles.push({x,y:y-14,rx:w*.36,ry:Math.min(30,h*.25)});
 else if(f==='base')obstacles.push({x,y:y-Math.min(w,260)*.14,rx:w*.42,ry:Math.min(w,260)*.17});
 else if(f==='low')obstacles.push({x,y:y-h*.3,rx:w*.4,ry:h*.28});
 else if(f==='pole')obstacles.push({x,y:y-8,rx:18,ry:12});
 else if(f==='arch')for(const side of [-1,1])obstacles.push({x:x+side*w*.36,y:y-14,rx:w*.14,ry:20});
 else if(f==='hall')obstacles.push({poly:[[x-w*.46,y-h*.34],[x+w*.46,y-h*.34],[x+w*.46,y-h*.08],[x+w*.25,y-h*.08],[x+w*.25,y],[x-w*.25,y],[x-w*.25,y-h*.08],[x-w*.46,y-h*.08]]});
 return p;
}
const CENTRE=JSON.parse(readFileSync(ART+'centre/centre.json'));
function centre(spec,cp,scale,label){
 const [ox,oy]=T(cp);
 for(const p of spec.pieces){
  const x=ox+p.x*scale,y=oy+p.y*scale,w=p.width*scale,h=p.height*scale;
  if(p.layer==='decal'||p.layer==='back')flats.push({src:'centre/'+p.file,x,y,width:w,height:h,topLeft:true,flip:p.flip??false});
  else{const sort=oy+(p.sortY??p.at[1])*scale;props.push({id:'lib-'+p.id,name:label+' '+p.id,src:'centre/'+p.file,x:x+w/2,y:sort,width:w,height:h,scale:1,anchor:{x:.5,y:(sort-y)/h},flip:p.flip??false,shadow:false});}
 }
 for(const b of spec.blocked){const e=b.ellipse;obstacles.push({x:ox+e.x*scale,y:oy+e.y*scale,rx:e.rx*scale,ry:e.ry*scale,name:b.name});}
 return {x:ox,y:oy,rx:spec.outerEdge.rx*scale,ry:spec.outerEdge.ry*scale};
}
const plaza=centre(CENTRE,[440,455],1.05,'Globe fountain');
const market=centre(CENTRE.bookstore,[1160,300],1.15,'Bookstore');
const hall=put('hall',[440,292],'hall',{mult:1.3});
for(const c of [[275,337],[620,337],[210,445],[658,490],[320,620],[565,620]])put('pencil-lamp',c,'plaza');
for(const [c,flip] of [[[285,605],false],[[600,600],true],[[275,315],false],[[600,315],true]])put('book-bench',c,'plaza',{flip});
for(const c of [[350,640],[515,640],[265,290],[625,290]])put('inkwell-planter',c,'plaza');
put('lantern-tree',[145,605],'story');put('reading-cushion',[110,640],'story');put('book-pile',[167,653],'story');
put('reading-cushion',[965,510],'pond');put('open-book',[955,497],'pond');put('book-pile',[993,505],'pond');
for(const c of [[848,550],[870,605],[980,580]])put('reeds',c,'pond');
put('cattails',[950,533],'pond');put('book-bench',[860,635],'pond');
for(const [i,c] of [[0,[898,570]],[1,[928,556]],[2,[940,580]]]){
 const a=ASSET[i===1?'lily-pad-flower':'lily-pad-large'];floating.push({src:a.src,x:T(c)[0],y:T(c)[1],width:a.w*.20,height:a.h*.20,phase:i*2});
}
put('book-climber',[1320,492],'playground');put('book-slide',[1400,490],'playground',{flip:true});
put('toy-blocks',[1330,535],'playground');put('block-steps',[1410,540],'playground');
put('reading-cushion',[1283,540],'playground');put('pencil-lamp',[1460,555],'playground');
for(const c of [[1010,610],[1400,600],[1060,755],[1375,755]])put('pencil-lamp',c,'square');
for(const c of [[1100,570],[1310,570],[1080,770],[1360,770]])put('planter-flowers',c,'square');
put('book-bench',[1030,810],'square');put('book-bench',[1430,732],'square',{flip:true});
for(const [n,c] of [['umbrella-cafe',[1140,863]],['umbrella-garden',[1370,850]],['picnic-blanket',[1100,885]],['towel-striped',[1350,875]],['beach-ball',[1270,870]],['sandcastle-small',[1050,915]],['bucket',[1080,920]],['starfish-orange',[1220,900]],['shell-scallop',[1400,842]]])put(n,c,'beach');
const J5={file:'public/pixi-art/bridge-jetty-5.svg',vb:[5004.9592,1492.5089,494.0617,277.2587],a:[5034.08,1638.41],b:[5469.9,1681.99]};
const J1={file:'public/pixi-art/bridge-jetty-1.svg',vb:[3222.39,3276.877,229.2164,476.233],a:[3320,3319],b:[3320,3730]};
function deck(name,J,at,sx,sy,{split=false,width=115}={}){
 let inner=readFileSync(J.file,'utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 const map=([x,y])=>[at[0]+(x-J.a[0])*sx,at[1]+(y-J.a[1])*sy];
 const [vx,vy,vw,vh]=J.vb,a=map([vx,vy]),b=map([vx+vw,vy+vh]);
 const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]);
 const wrap=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(${at[0]} ${at[1]}) scale(${sx} ${sy}) translate(${-J.a[0]} ${-J.a[1]})">${s}</g></svg>`;
 if(split){const near=inner.match(/<g id="near-railing">[\s\S]*?<\/g>/)?.[0]??'';inner=inner.replace(near,'');writeFileSync(ART+name+'-front.svg',wrap(near));const sort=at[1]+width*.5;props.push({id:name+'-rail',name:'Canal bridge front rail',src:name+'-front.svg',x:x+w/2,y:sort,width:w,height:h,scale:1,anchor:{x:.5,y:(sort-y)/h},shadow:false});}
 writeFileSync(ART+name+'.svg',wrap(inner));decks.push({src:name+'.svg',x,y,width:w,height:h});
 const end=map(J.b);walkways.push({a:at,b:end,w:width});arches.push({a:at,b:end,w:width,r:70*Math.abs(sy)});return {a:at,b:end};
}
const upper=deck('canal-bridge-north',J5,T([680,385]),2.05,1.55,{split:true,width:200});
const lower=deck('canal-bridge-south',J5,T([675,730]),1.85,1.55,{split:true,width:200});
const west=deck('jetty-west',J5,T([136,153]),-.85,1,{width:115});
const east=deck('jetty-east',J5,T([1395,150]),.85,1,{width:115});
const south=deck('jetty-south',J1,T([1340,885]),1,.88,{width:115});
const hFoot=T([170,889]),hTip=[hFoot[0],hFoot[1]+390];
const harbor={jetty:{foot:hFoot,tip:hTip,width:120},spawn:[plaza.x,plaza.y+CENTRE.spawn[1]*1.05],boats:[
 {x:hTip[0]-170,y:hTip[1]-70,turn:Math.PI},{x:hTip[0]+170,y:hTip[1]-70,turn:Math.PI},{x:hTip[0]-170,y:hTip[1]-270,turn:Math.PI},
 ...[west,east].map((d,i)=>({x:d.b[0],y:d.b[1]+175,turn:i?Math.PI/2:-Math.PI/2})),
 {x:south.b[0]-170,y:south.b[1]-30,turn:Math.PI},{x:south.b[0]+170,y:south.b[1]-30,turn:Math.PI}]};
const zones={plaza:{...plaza,spawn:harbor.spawn},hall:{x:hall.x,y:hall.y,spawn:[hall.x,hall.y+80]},bookstore:{...market,spawn:[market.x,market.y+CENTRE.bookstore.door.point[1]*1.15]},pond:{...POND,spawn:T([915,622])},playground:{x:T([1360,520])[0],y:T([1360,520])[1],spawn:T([1360,553])},beach:{x:T([1220,865])[0],y:T([1220,865])[1],spawn:T([1220,865])}};
for(const z of [...ACT,...STALL_ROWS])zones[z.id]={...z,spawn:[z.x,z.y]};
const sleepAvoid=[plaza,market,...ACT,...STALL_ROWS].map(p=>({...p,rx:p.rx+100,ry:p.ry+80}));
sleepAvoid.push({...oval([440,300,160,40]),name:'hall steps'}, {...oval([1360,510,110,70]),name:'playground'});
for(const z of Object.values(zones))sleepAvoid.push({x:z.spawn[0],y:z.spawn[1],rx:155,ry:140,name:'zone entry'});
const pathNear=(x,y,pad=0)=>PATHS.some(p=>lineDist(x,y,p.line)<p.w/2+pad);
const reserved=(x,y,pad=0)=>[plaza,market,...ACT,...STALL_ROWS].some(e=>inShape(x,y,e,pad));
const fits=(x,y,room=80,tall=0,understory=false)=>land(x,y,180)&&!inPoly(x,y,BEACH)&&!pathNear(x,y,room*.4)&&!reserved(x,y,room)
 &&!water.some(e=>inShape(x,y,e,room+50))&&!walkways.some(b=>segDist(x,y,b.a,b.b)<b.w/2+room+50)
 &&!inShape(x,y,oval([1360,510,115,65]),room)
 &&!Object.values(zones).some(z=>Math.hypot(x-z.spawn[0],y-z.spawn[1])<room+110)
 &&(!tall||!walkways.some(b=>x+190>Math.min(b.a[0],b.b[0])-50&&x-190<Math.max(b.a[0],b.b[0])+50&&y>Math.min(b.a[1],b.b[1])-40&&y-tall<Math.max(b.a[1],b.b[1])+80))
 &&!props.some(p=>Math.hypot(p.x-x,(p.y-y)*1.4)<(understory&&/^(bush|flower)-/.test(p.asset??'')?55:room+Math.min(250,p.width*(p.scale??1)*.45)))
 &&(!tall||!reserved(x,y-tall*.65,room*.3))
 &&!(Math.abs(x-hall.x)<hall.width*hall.scale*.6&&y>hall.y-hall.height*hall.scale&&y<hall.y+100);
for(let n=0,t=0;n<62&&t<20000;t++){
 const x=500+rnd()*6900,y=600+rnd()*4300;
 if(!fits(x,y,190,380)||!land(x,y-250,80))continue;
 put(`tree-${1+n%5}`,[x,y],'garden',{world:true,flip:rnd()<.5});n++;
}
for(let n=0,t=0;n<55&&t<18000;t++){
 const x=500+rnd()*6900,y=600+rnd()*4300;
 if(!fits(x,y,80))continue;put(`bush-${1+n%6}`,[x,y],'garden',{world:true,flip:rnd()<.5});n++;
}
for(const [n,c] of [['tower-1',[255,180]],['tower-2',[1050,110]],['tower-3',[590,865]],['tower-4',[1450,685]],['shelf-arch',[180,270]],['book-stall-red',[250,680]],['book-stall-blue',[660,570]]]){
 const [x,y]=T(c);if(fits(x,y,50))put(n,c,'reading');
}
const sleepSpots={nod:[],hammock:[],rock:[],leaf:[],book:[],chair:[],wing:[],box:[]};
const counts={nod:6,hammock:4,rock:4,leaf:6,book:6,chair:3,wing:6,box:5};
const walkBase={width:W,height:HH,coast:WALK_COAST,obstacles,water,bridges,islets,walkways:[...walkways,{a:hFoot,b:hTip,w:120}],paths:PATHS.map(p=>p.line)};
const geo=geometry(walkBase),sizes=sleepHalfWidths();
const checkBeds=()=>resolveSleepSpots(walkBase,props,geo.walkable,sizes,{spots:sleepSpots,avoid:sleepAvoid,warn:false});
seed=7626;
for(const tree of props.filter(p=>/^tree-/.test(p.asset??''))){
 if(sleepSpots.nod.length===counts.nod)break;
 if(pathNear(tree.x,tree.y,120)||reserved(tree.x,tree.y,160)||!geo.walkable(tree.x,tree.y+55))continue;
 sleepSpots.nod.push([tree.id,0,rnd()<.5]);if(checkBeds().bad.length)sleepSpots.nod.pop();
}
for(const pose of ['chair','hammock','book','rock','leaf','wing','box']){
 for(let t=0;t<90000&&sleepSpots[pose].length<counts[pose];t++){
  const x=r1(550+rnd()*6800),y=r1(700+rnd()*4200),r=sizes[pose];
  if(!land(x,y,150)||pathNear(x,y,r*.8+35)||reserved(x,y,130)||!geo.walkable(x,y))continue;
  if(pose==='chair'?!inPoly(x,y,BEACH):inPoly(x,y,BEACH))continue;
  const nearby=props.some(p=>Math.hypot(p.x-x,(p.y-y)*1.3)<560&& (pose==='book'?/hall|book|shelf|cushion|stall/i.test(p.name):pose==='hammock'?/tree/i.test(p.name):true));
  if(!nearby)continue;
  sleepSpots[pose].push([x,y,pose==='chair'||rnd()<.5]);
  if(checkBeds().bad.length)sleepSpots[pose].pop();
 }
}
let leafPlaced=false;
for(let y=710;y<=810&&!leafPlaced;y+=25)for(let x=1900;x<=2600;x+=35){
 sleepSpots.leaf[1]=[x,y,sleepSpots.leaf[1][2]];
 if(!checkBeds().bad.length&&!props.some(p=>p.y>y-20&&p.y-y<p.height*p.scale*.99&&Math.abs(x-p.x)<p.width*p.scale*.45+40)){leafPlaced=true;break;}
}
if(!leafPlaced)throw Error('no visible north-lawn leaf bed');
const beds=checkBeds();
for(const [p,n] of Object.entries(counts))if(sleepSpots[p].length!==n)throw Error(`sleep ${p}: ${sleepSpots[p].length}/${n}`);
const pondDock=deck('pond-reading-dock',J1,T([915,590]),.65,.4,{width:90});
walkBase.walkways.push(walkways.at(-1));
bridges.push({x:pondDock.a[0],y:(pondDock.a[1]+pondDock.b[1])/2,w:90,h:Math.abs(pondDock.b[1]-pondDock.a[1])+40});
const bedNear=(x,y,room=60)=>beds.some(b=>Math.hypot(x-b.x,(y-b.y)*1.5)<b.r+room+110||(y>b.y-20&&y<b.y+300&&Math.abs(x-b.x)<b.r+room));
const hidesBed=(p,x=p.x,y=p.y)=>beds.some(b=>p.id!==b.tree&&y>b.y-20&&y-b.y<p.height*p.scale*.95&&Math.abs(x-b.x)<p.width*p.scale*.45+b.r*.6);
for(const p of props.filter(p=>(/^tree-/.test(p.asset??'')||p.asset==='lantern-tree')&&hidesBed(p))){
 const ox=p.x,oy=p.y;let moved=false;
 for(let r=250;r<=1000&&!moved;r+=75)for(let a=0;a<Math.PI*2;a+=Math.PI/12){
  const x=ox+Math.cos(a)*r,y=oy+Math.sin(a)*r;
  if(!fits(x,y,40,p.height*p.scale)||bedNear(x,y,100)||hidesBed(p,x,y))continue;
  const footprint=obstacles.find(o=>Math.abs(o.x-ox)<.11&&Math.abs(o.y-(oy-9))<.11&&o.rx===31);
  if(!footprint)throw Error(`missing tree footprint ${p.id}`);
  p.x=r1(x);p.y=r1(y);footprint.x=p.x;footprint.y=p.y-9;moved=true;break;
 }
 if(!moved)throw Error(`could not reveal sleeper behind ${p.id}`);
}
const treeSeeds=props.filter(p=>/^tree-/.test(p.asset??''));
let addedTrees=0;
for(let t=0;t<140000&&treeSeeds.length+addedTrees<66;t++){
 const parent=treeSeeds[t%treeSeeds.length],a=rnd()*Math.PI*2,dist=210+rnd()*340;
 const x=t%3===0?500+rnd()*6900:parent.x+Math.cos(a)*dist,y=t%3===0?600+rnd()*4300:parent.y+Math.sin(a)*dist*.85;
 if(!fits(x,y,45,380,true)||!land(x,y-240,65)||bedNear(x,y,80))continue;
 const treeName=`tree-${1+t%5}`,tw=ASSET[treeName].w*SCALE.tree,th=ASSET[treeName].h*SCALE.tree;
 if(pathNear(x,y-th*.57,tw*.46))continue;
 if(props.filter(q=>/^tree-/.test(q.asset??'')).some(q=>{
  const qw=q.width*q.scale,qh=q.height*q.scale;
  return Math.hypot((x-q.x)/(tw*.38+qw*.38),(y-th*.58-(q.y-qh*.58))/(th*.28+qh*.28))<1;
 }))continue;
 const p=put(treeName,[x,y],'grove',{world:true,flip:rnd()<.5});
 if(checkBeds().bad.length||hidesBed(p)){props.pop();obstacles.pop();pid--;continue;}
 addedTrees++;
}
for(const [zi,z] of [...ACT,...STALL_ROWS].entries()){
 const N=zi<3?30:16;
 for(let i=0;i<N;i++){
  const a=i/N*Math.PI*2,x=z.x+Math.cos(a)*(z.rx+95),y=z.y+Math.sin(a)*(z.ry+72);
  if(!fits(x,y,25)||bedNear(x,y,70))continue;
  put(i%7===0?`bush-${1+i%6}`:`flower-${1+i%3}`,[x,y],'activity-border',{world:true,mult:i%7===0?.72:1});
 }
 for(const a of [Math.PI*.19,Math.PI*.82,Math.PI*1.18,Math.PI*1.8]){
  const x=z.x+Math.cos(a)*(z.rx+155),y=z.y+Math.sin(a)*(z.ry+135);
  if(!fits(x,y,55)||bedNear(x,y,145))continue;
  put(zi%2?'pencil-lamp':'bench-wood',[x,y],'activity-border',{world:true});
 }
}
for(let n=0,t=0;n<60&&t<14000;t++){
 const tree=props.filter(p=>/^tree-/.test(p.asset??''))[t%(treeSeeds.length+addedTrees)];
 const x=tree.x+(rnd()-.5)*470,y=tree.y+40+rnd()*145;
 if(!fits(x,y,35)||bedNear(x,y,85))continue;
 put(n%5===0?'rock-round':`bush-${1+n%6}`,[x,y],'grove-understory',{world:true,mult:n%5===0?1:.75});n++;
}
for(let n=0,t=0;n<18&&t<12000;t++){
 const x=600+rnd()*6800,y=700+rnd()*4200;
 if(!fits(x,y,75)||bedNear(x,y,150)||!pathNear(x,y,250))continue;
 const name=['bench-wood','pencil-lamp','picnic-blanket','book-pile','signpost-three-way','bench-park'][n%6];
 put(name,[x,y],'reading-nook',{world:true});n++;
}
for(let n=0,t=0;n<150&&t<10000;t++){
 const x=500+rnd()*7000,y=600+rnd()*4400;if(!fits(x,y,40)||bedNear(x,y,45))continue;put(`flower-${1+n%3}`,[x,y],'garden',{world:true});n++;
}
for(let n=0,t=0;n<2600&&t<80000;t++){
 const x=500+rnd()*7000,y=600+rnd()*4400;
 if(!land(x,y,110)||pathNear(x,y,25)||[plaza,market,...ACT.filter(z=>z.kind==='paved')].some(e=>inShape(x,y,e,25))||water.some(e=>inShape(x,y,e,50))||inPoly(x,y,BEACH)||bedNear(x,y,30))continue;
 const k=['grass-tuft-1','grass-tuft-2','grass-tuft-3','flower-dot-1','flower-dot-2','flower-dot-3','pebble-1'][n%7],a=ASSET[k];
 flats.unshift({src:a.src,x,y,width:a.w*1.5,height:a.h*1.5,flip:rnd()<.5});n++;
}
for(let n=0,t=0;n<320&&t<30000;t++){
 const x=500+rnd()*7000,y=600+rnd()*4400;
 if(!land(x,y,20)||(!inPoly(x,y,BEACH)&&land(x,y,105))||bedNear(x,y,40))continue;
 const k=['sand-speck-1','sand-speck-2','pebble-1','pebble-2'][n%4],a=ASSET[k];
 flats.unshift({src:a.src,x,y,width:a.w*1.5,height:a.h*1.5,flip:rnd()<.5});n++;
}
libraryArcBenches({artDir:ART,props,obstacles,plaza,market});
libraryCloseupFurniture({artDir:ART,props,obstacles,ACT,STALL_ROWS,plaza,market,put,fits,bedNear,pathNear,land,PATHS,flats,ASSET});
const g=[];
g.push('<defs><pattern id="sea-ripples" width="210" height="144" patternUnits="userSpaceOnUse"><path d="M12 28q18 9 36 0m74 60q18 8 36 0M66 129q14 7 28 0" fill="none" stroke="#D5F3EC" stroke-width="2" stroke-dasharray="3 6" opacity=".25"/></pattern></defs><rect width="8000" height="5600" fill="url(#sea-ripples)"/>');
for(const ring of rings){
 for(const [distance,width,col,alpha] of [[-115,18,C.halo,.35],[-75,22,C.waterHi,.3],[-38,12,C.waterHi,.55]])g.push(`<path d="${dz(offset(ring,distance))}" fill="none" stroke="${col}" stroke-width="${width}" opacity="${alpha}"/>`);
 g.push(`<path d="${dz(ring)}" fill="${C.halo}" stroke="${C.halo}" stroke-width="68" opacity=".5"/>`);
 g.push(`<path d="${dz(ring)}" fill="${C.sand}" stroke="${C.waterHi}" stroke-width="22"/>`);
 g.push(`<path d="${dz(offset(ring,7))}" fill="${C.sand}" stroke="#FFF4CB" stroke-width="9"/>`);
 g.push(`<path d="${dz(offset(ring,110))}" fill="${C.grass}" stroke="${C.grassDeep}" stroke-width="9"/>`);
 const foam=offset(ring,-14);for(let i=0;i<foam.length-8;i+=16)g.push(`<path d="${d(foam.slice(i,i+6))}" fill="none" stroke="#FFF7D9" stroke-width="6" opacity=".85"/>`);
}
g.push(`<clipPath id="land"><path d="${rings.map(dz).join(' ')}"/></clipPath>`);
g.push('<g clip-path="url(#land)">');
for(let n=0;n<40;n++){
 const x=700+rnd()*6600,y=700+rnd()*4100;if(!land(x,y,300)||reserved(x,y,50))continue;
 g.push(`<ellipse cx="${x}" cy="${y}" rx="${70+rnd()*160}" ry="${30+rnd()*70}" fill="${C.grassShade}" opacity=".5"/>`);
}
g.push(`<path d="${dz(BEACH)}" fill="${C.sand}" stroke="${C.sandShade}" stroke-width="7"/>`);
const visualPaths=PATHS.map((p,i)=>i===7?{...p,line:[...p.line,[p.line.at(-1)[0],ACT[2].y-ACT[2].ry*.67]]}:p);
for(const [colour,pad]of [['#69753E',9],[C.sandShade,5],[C.sand,0]])for(const p of visualPaths)
 g.push(`<path d="${d(p.line)}" fill="none" stroke="${colour}" stroke-width="${p.w+pad}"/>`);
g.push(libraryPathInlays(visualPaths));
for(const [i,z] of [...ACT,...STALL_ROWS].entries()){
 if(i>=3)continue;
 const paved=z.kind==='paved';
 const profile=paved?[[-.9,-.38],[-.7,-.72],[0,-.74],[.70,-.72],[.9,-.38],[.9,.38],[.7,.72],[0,.74],[-.7,.72],[-.9,.38]]:[[-.95,-.20],[-.76,-.69],[-.24,-.96],[.42,-.9],[.84,-.56],[.98,.10],[.72,.71],[.14,.98],[-.56,.82],[-.94,.34]];
 const border=catmull(profile.map(([x,y])=>[z.x+x*z.rx,z.y+y*z.ry]),true,8);
 g.push(`<path d="${dz(border)}" fill="${paved?C.pave:i<3?'#9BBD35':C.grass}" stroke="${paved?C.sandShade:'#83AD30'}" stroke-width="${paved?8:6}"/>`);
 if(paved)g.push(libraryCourtPaving(z,border));
}
for(const [pad,col] of [[20,C.sandShade],[13,C.sand],[4,C.ink],[0,C.water]])g.push(`<ellipse cx="${POND.x}" cy="${POND.y}" rx="${POND.rx+pad}" ry="${POND.ry+pad}" fill="${col}"/>`);
g.push(`<path d="M${POND.x-POND.rx*.65} ${POND.y-POND.ry*.3} Q${POND.x} ${POND.y-POND.ry*.8} ${POND.x+POND.rx*.6} ${POND.y-POND.ry*.35}" fill="none" stroke="${C.waterHi}" stroke-width="8"/>`);
g.push(`<ellipse cx="${hFoot[0]}" cy="${hFoot[1]-55}" rx="155" ry="85" fill="${C.sand}"/>`);
g.push('</g>');
const body=g.join('\n');
const head=(vb,w,h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" stroke-linecap="round" stroke-linejoin="round"><title>Pagepond, two garden islands and canal</title>`;
writeFileSync(ART+'ground.svg',head(`0 0 ${W} ${HH}`,W,HH)+body+'</svg>');
const tiles=[];const TW=Math.ceil(W/6),TH=Math.ceil(HH/4);
for(let r=0;r<4;r++)for(let c=0;c<6;c++){
 const x=c*TW,y=r*TH,w=Math.min(TW,W-x),h=Math.min(TH,HH-y),src=`ground-r${r}-c${c}.svg`;
 writeFileSync(ART+src,head(`${x} ${y} ${w} ${h}`,w,h)+body+'</svg>');tiles.push({src,x,y,width:w,height:h});
}
const world={width:W,height:HH,theme:'library',name:'Pagepond',coast:EDGE,coastRings:rings,water,bridges,obstacles,islets,walkways,arches,zones,sleepSpots,sleepAvoid,paths:PATHS.map(p=>p.line),props,
 ambient:{birds:[[350,400],[600,800],[950,400],[1200,600],[1300,850],[300,800]].map(T),butterflies:[[175,600],[910,620],[360,745],[590,145],[1210,780],[1050,100]].map(T)}};
const walk={...walkBase,walkways,coastRings:rings.map(p=>offset(p,35))};
const art={width:W,height:HH,sea:C.water,ground:{tiles},decks,flats,props,floating};
const dump=(f,v)=>writeFileSync(f,JSON.stringify(v,null,1));
dump(DATA+'world.json',world);dump(DATA+'walk-world.json',walk);dump(DATA+'harbor.json',harbor);dump(DATA+'placements.json',props);dump(DATA+'paths.json',world.paths);dump(ART+'art.json',art);
dump(ART+'resolved-sleepers.json',beds);
const home=JSON.parse(readFileSync('assets/world/world.json'));
const metrics={landArea:rings.reduce((s,p)=>s+Math.abs(area(p)),0),homeArea:Math.abs(area(home.coast)),map:[W,HH],landmasses:2,canalBridges:2,jetties:4,sleepers:beds.length,counts,props:props.length,trees:props.filter(p=>/^tree-/.test(p.asset??'')).length,paths:{main:240,minor:190},activityAreas:ACT.length,stallRows:STALL_ROWS.length};
metrics.ratioToHome=metrics.landArea/metrics.homeArea;dump(ART+'build-metrics.json',metrics);console.log(metrics);
if(checkBeds().bad.length)throw Error(JSON.stringify(checkBeds().bad));
