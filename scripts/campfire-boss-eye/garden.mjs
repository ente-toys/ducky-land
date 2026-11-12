import {Path2D,PathOp,ring} from '../pagepond/geometry.mjs';
export function plantOuter({art,world,props,shapes,floor,dry,locked,ellipse,contactPoly}) {
 const added=[],declined=[],beds=[],old=art.props,all=()=>[...old,...props];
 const intersects=(a,b)=>{const x=a.getBounds(),y=b.getBounds();if(x[0]>=y[2]||x[2]<=y[0]||x[1]>=y[3]||x[3]<=y[1])return false;const q=new Path2D(a).op(b,PathOp.Intersect).getBounds();return q[2]-q[0]>.2&&q[3]-q[1]>.2;};
 const inside=p=>{const b=new Path2D(p).op(dry,PathOp.Difference).getBounds();return b[2]-b[0]<.2||b[3]-b[1]<.2;};
 const sleepRooms={
 book:[[1550,-300],[3650,-430],[6550,-140],[8650,2400],[6950,5880],[3200,5700],[-100,3700],[-850,1800]],
 leaf:[[2300,350],[5200,-500],[8100,250],[8850,4900],[5250,6050],[1800,5570],[-750,2600],[3200,5300]],
 wing:[[2900,-500],[5900,270],[6800,50],[8650,5450],[6200,5600],[2750,6400],[-1000,4050],[6200,4610]],
 rock:[[4550,-400],[7150,80],[7950,2650],[8750,4050],[4500,5700],[1900,5100],[250,2200],[2450,6070]]
 };
 for(const [pose,points]of Object.entries(sleepRooms))for(const [i,[x,y]]of points.entries()){world.sleepSpots[pose].push([x,y,i%2===0]);beds.push({pose,x,y});}
 world.sleepTotal=72;
 const arrivals=[[3460,-10],[-200,2630],[2890,5760],[5350,5510],[8800,4700]];
 const keepBeds=p=>beds.some(b=>Math.abs(p.x-b.x)<p.width/2+130&&p.y>b.y-75&&p.y-p.height<b.y+60);
 function put(src,x,y,width,height,kind,room,flip=false){
  const id='outer-'+room+'-'+added.length;
  const p={id,name:kind==='tree'?'Campfire grove tree':kind==='bush'?'Campfire flower bush':kind==='flower'?'Campfire flowers':kind,src,x,y,width,height,scale:1,anchor:{x:.5,y:1},flip,shadow:false,groundShadow:true,outerGarden:room,kind,contact:kind!=='detail'};
  const rx=kind==='tree'?width*.095:kind==='bush'?width*.33:kind==='detail'?width*.35:width*.38;
  const ry=kind==='tree'?13:kind==='bush'?height*.15:kind==='detail'?4:Math.min(25,height*.16);
  const shape=ellipse(x,y-ry*.7,rx,ry),visual=new Path2D();visual.rect(x-width*.43,y-height*.85,width*.86,height*.85);
  const pathClear=kind==='tree'?visual:ellipse(x,y-height*.3,width*.5,Math.max(ry,height*.3));
  if(!inside(ellipse(x,y,width*.53,Math.min(65,height*.3)))||intersects(shape,locked)||intersects(pathClear,floor)||intersects(new Path2D(shape).stroke({width:12}).op(shape,PathOp.Union),floor)||world.obstacles.some(o=>intersects(shape,o.poly?new Path2D(ring(o.poly)):ellipse(o.x,o.y,o.rx,o.ry)))||keepBeds(p)||arrivals.some(([ax,ay])=>Math.hypot(x-ax,y-ay)<100+rx)||all().some(q=>(q.kind==='building'||(kind==='tree'&&(q.hamlet&&q.kind!=='tree'&&!q.parent||q.kind==='table'||q.kind==='sign')))&&Math.abs(x-q.x)<(width+q.width)*.48&&y>q.y-q.height*.9&&y-height<q.y+35)||shapes.some(s=>s.solid&&intersects(shape,new Path2D(s.shape).stroke({width:14}).op(s.shape,PathOp.Union)))) {declined.push({room,kind,x,y});return null;}
  if(kind==='tree'&&all().some(q=>q.kind==='tree'&&Math.hypot(q.x-x,(q.y-y)*1.4)<70)){declined.push({room,kind,x,y});return null;}
  p.footprint={poly:contactPoly(shape)};props.push(p);added.push(p);
  shapes.push({id,kind,outerGarden:room,solid:kind==='tree'||kind==='bush'||kind==='table'||kind==='sign',shape});return p;
 }
 for(const [i,[x,y]]of [[1280,260],[2450,-260],[4150,-250],[5900,-200],[-850,2250],[120,2450],[8650,2250],[8800,4670],[2070,5280],[4710,5990],[5900,6000],[6380,5260]].entries()){
  put('detail/game-table.svg',x,y,190,123,'table','games-'+i);
  for(const [dx,dy]of [[-150,20],[140,45]]){put('detail/bush-lavender.svg',x+dx,y+dy,105,84,'bush','games-'+i);put('/pixi-art/plants/flower-1.svg',x+dx-35,y+dy+55,48,36,'flower','games-'+i);}
 }
 for(const [i,[x,y]]of [[1100,1280],[2170,250],[3810,180],[6240,480],[7440,1630],[8100,2730],[-350,2670],[290,3920],[1510,6180],[3850,6300],[5500,5780],[8140,5910]].entries())put('detail/emoji-sign.svg',x,y,110,118,'sign','fork-'+i,i%2===1);
 const rooms=[
 ['north-story',1350,-90,0],['north-library',2000,-350,1],['north-west',2670,-360,2],['north-crown',3350,-300,0],['north-heart',4100,-370,1],['north-east',4780,-350,2],['north-lilac',5550,-240,0],['north-quilt',6200,-70,1],
 ['crown-coast-a',2250,-790,1],['crown-coast-b',3000,-850,0],['crown-coast-c',3850,-880,2],['crown-coast-d',4700,-830,1],['crown-coast-e',5450,-740,0],['crown-coast-f',6100,-560,2],
 ['north-bank-a',1850,510,2],['north-bank-b',2900,320,1],['north-bank-c',3750,305,0],['north-bank-d',4750,295,2],['north-bank-e',5750,430,1],
 ['west-story',-790,1270,0],['west-coast-a',-1120,2050,1],['west-middle',-1100,2700,2],['west-bank-a',290,1720,1],['west-bank-b',230,2410,0],['west-river',20,2880,2],
 ['east-quilt',8820,1450,0],['east-coast-a',9110,2190,2],['east-middle',9090,2900,1],['east-bank-a',7740,2020,1],['east-bank-b',7980,2720,0],['east-river',8640,3180,2],
 ['west-south-river',-960,3980,0],['west-south-coast',-900,4540,1],['west-sprout-edge',-520,4040,2],['west-sprout-bank',990,3920,1],
 ['east-south-river',8970,4290,2],['east-south-coast',9110,5010,0],['east-loaf-edge',8910,5680,1],['east-loaf-bank',8040,4160,0],
 ['south-sprout',1800,5800,0],['south-book',2300,5340,1],['south-west-meadow',2930,5540,2],['south-west-bank',2800,5020,0],['south-port-west',3500,5820,1],['south-port-east',4500,5900,0],['south-meadow',5020,5710,2],['south-lilac',5700,5760,1],['south-loaf',6350,5910,0],['south-east-meadow',6880,6190,2],
 ['south-coast-a',1570,6470,1],['south-coast-b',2330,6620,2],['south-coast-c',3170,6620,0],['south-coast-d',4640,6650,1],['south-coast-e',5420,6530,0],['south-coast-f',6120,6520,2],['south-coast-g',7330,6360,1],
 ['story-back',950,-230,1],['story-south',1190,1120,2],['patch-back',7570,60,0],['patch-south',8700,1810,2],['sprout-south',600,6020,0],['sprout-east',1730,5060,2],['loaf-south',7560,5990,1],['loaf-west',6550,5550,2]
 ];
 const palettes=[['detail/tree-wisteria.svg',330,357],['/pixi-art/plants/tree-1.svg',280,388],['/pixi-art/plants/tree-3.svg',290,367],['/pixi-art/plants/tree-4.svg',180,252],['detail/tree-lilac.svg',300,320],['/pixi-art/plants/tree-2.svg',135,270]];
 const motifs=[[[0,-95,0,1],[-230,-10,1,.94],[215,15,2,.85],[-105,130,3,.85],[150,180,4,.9],[315,150,5,.76]],[[0,-90,2,1],[-205,25,0,.88],[205,55,1,.82],[-310,135,5,.8],[-65,160,3,.9],[200,235,4,.84]],[[0,-70,4,1],[-200,45,2,.85],[225,35,0,.85],[-100,170,1,.78],[140,205,3,.9]]];
 for(const [room,cx,cy,m]of rooms){
  for(const [dx,dy,t,k]of motifs[m]){const [src,w,h]=palettes[t];put(src,cx+dx,cy+dy,w*k,h*k,'tree',room,dx<0);}
  for(const [dx,dy,t,k]of [[-255,200,0,1],[-145,240,1,.8],[20,255,0,.8],[120,300,2,1],[280,240,0,.9],[-300,290,2,.8]]){const src=t===0?'detail/bush-lavender.svg':t===1?'/pixi-art/plants/bush-1.svg':'/pixi-art/plants/bush-2.svg';put(src,cx+dx,cy+dy,125*k,(t===0?100:82)*k,'bush',room);}
  for(const [dx,dy,t]of [[-200,340,1],[-55,310,2],[70,380,3],[270,335,1],[-320,360,3]])put('/pixi-art/plants/flower-'+t+'.svg',cx+dx,cy+dy,48,36,'flower',room);
  for(const [dx,dy,t]of [[-310,45,1],[-130,335,2],[25,370,3],[330,155,2],[150,90,1],[-75,-170,3],[315,345,1]])put('/pixi-art/decals/grass-tuft-'+t+'.svg',cx+dx,cy+dy,56,31,'detail',room);
  for(const [dx,dy,t]of [[-180,115,1],[230,325,2],[-30,280,1]])put('/pixi-art/decals/pebble-'+t+'.svg',cx+dx,cy+dy,38,24,'detail',room);
 }
 const borders=[
 [1250,710],[1470,580],[2200,410],[2500,345],[3200,270],[3450,275],[4350,265],[5200,320],[5500,375],[6040,560],[6360,720],
 [470,1500],[355,1860],[310,2140],[290,2580],[260,2790],[7740,1790],[7850,2270],[7910,2500],[7950,2860],
 [1230,3950],[1430,4160],[2180,4750],[2450,4880],[2900,5260],[3250,5440],[4600,5440],[4890,5360],[5740,4990],[6050,4850],[6580,4480],[7770,3900],
 [550,1540],[-300,2100],[-290,2590],[-270,3780],[-430,4350],[7830,2340],[8220,2740],[8240,3990],[8240,4500],
 [1000,6080],[1600,6190],[2050,5940],[3000,5880],[3600,6040],[4330,6080],[5180,5820],[5760,5950],[6730,6050],[7390,6110]
 ];
 for(const [i,[x,y]]of borders.entries())for(const [dx,dy,t]of [[-62,0,0],[55,28,1],[145,13,2]])put(t===0?'detail/bush-lavender.svg':'/pixi-art/plants/bush-'+(t===1?1:2)+'.svg',x+dx,y+dy,105,t===0?84:69,'bush','border-'+i);
 for(const p of props.filter(p=>p.hamlet&&p.kind==='building'&&/cottage/.test(p.blueprintId))){for(const [dx,dy]of [[-p.width*.55,-15],[p.width*.55,10]]){put('detail/bush-lavender.svg',p.x+dx,p.y+dy,110,88,'bush',p.hamlet+'-door');put('/pixi-art/plants/flower-3.svg',p.x+dx-45,p.y+dy+45,48,36,'flower',p.hamlet+'-door');}}
 for(const p of props.filter(p=>p.hamlet&&/bench/.test(p.blueprintId)&&!p.parent))for(const dx of [-p.width*.7,p.width*.7])put('detail/flowers-purple.svg',p.x+dx,p.y+15,65,41,'flower',p.hamlet+'-bench');
 return {added:added.length,counts:Object.fromEntries(['tree','bush','flower','detail','table','sign'].map(k=>[k,added.filter(p=>p.kind===k).length])),rooms:rooms.map(r=>r[0]),sleepRooms,declined};
}
