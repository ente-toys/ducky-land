import { THREE, P, group, box, sphere, cylinder, cone, torus, line, extrude, mesh } from './primitives.js';

function finish(g, motion) {
  g.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(g);
  for (const child of g.children) child.position.y -= bounds.min.y;
  if (motion) g.userData.motion = motion;
  return g;
}

function flatShape(g, points, color, elevation = 0, depth = .06, smooth = false) {
  let outline = points;
  if (smooth) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x,z]) => new THREE.Vector3(x,z,0)),true,'catmullrom',.35);
    outline = curve.getPoints(36).map(p => [p.x,p.y]);
  }
  const object = extrude(g,outline,depth,color,0,elevation,0,0);
  object.rotation.x = -Math.PI/2;
  return object;
}

function ovalRing(g,rx,rz,y,color,r=.025,x=0,z=0, start=0, end=Math.PI*2) {
  const points=[];
  for(let i=0;i<=24;i++) { const a=start+(end-start)*i/24; points.push([x+Math.cos(a)*rx,y,z+Math.sin(a)*rz]); }
  return line(g,points,r,color);
}

function pond() {
  const g=group();
  const outline=[[-1.5,-.2],[-1.22,-.8],[-.5,-.93],[.25,-.72],[1.25,-.7],[1.56,-.15],[1.28,.6],[.4,.85],[-.45,.73],[-1.2,.67]];
  flatShape(g,outline,0x6cc24e,0,.12,true);
  flatShape(g,outline.map(([x,z])=>[x*.95,z*.91]),P.grass,.11,.045,true);
  flatShape(g,outline.map(([x,z])=>[x*.86,z*.76]),P.blue,.14,.035,true);
  const surface=flatShape(g,outline.map(([x,z])=>[x*.84,z*.73]),P.water,.175,.02,true);surface.name='water-surface';
  ovalRing(g,.45,.17,.207,0xbce9ff,.016,-.4,-.1,.15,Math.PI*1.24);
  ovalRing(g,.31,.11,.207,P.white,.012,.65,.18,0,Math.PI*.9);
  for(const [x,z,s] of [[-1.12,.48,.1],[1.32,-.1,.13],[-.8,-.77,.07]]) sphere(g,s,s*.55,s*.8,P.stone,x,.16,z);
  return finish(g,'water');
}

function pondEdge(kind) {
  const g=group(); let points;
  if(kind==='straight') points=[[-1.5,-.28],[1.5,-.28],[1.5,.28],[-1.5,.28]];
  if(kind==='cove') points=[[-1.5,-.65],[-.95,-.62],[-.8,-.05],[-.5,.25],[.6,.25],[.9,-.12],[1.08,-.64],[1.5,-.65],[1.5,.69],[-1.5,.69]];
  if(kind==='corner') points=[[-1.2,-.85],[-.52,-.85],[-.52,.2],[1.2,.2],[1.2,.82],[-1.2,.82]];
  if(kind==='island') points=[[-1.05,-.15],[-.77,-.64],[0,-.8],[.8,-.5],[1.1,.05],[.65,.61],[-.3,.76],[-.94,.39]];
  const smooth=kind==='island';
  flatShape(g,points,0x6cc24e,0,.16,smooth);
  flatShape(g,points.map(([x,z])=>[x*.99,z*.97]),P.grass,.16,.035,smooth);
  if(kind==='island') {
    for(const [x,z] of [[-.6,.3],[.5,-.2],[.1,.4]]) for(let i=0;i<3;i++) {
      const blade=cone(g,.035,.19+(i%2)*.08,P.leaf,x+(i-1)*.055,.24,z);blade.rotation.z=(i-1)*.35;
    }
  } else {
    const a=points[0],b=points[1];
    line(g,[[a[0]+.08,.2,-a[1]],[b[0]-.08,.2,-b[1]]],.015,0xb4eb8d);
  }
  return finish(g);
}

function wave(kind) {
  const g=group();
  if(kind==='crest'){
    const crest=extrude(g,[[-1.05,0],[-.97,.18],[-.66,.22],[-.44,.66],[-.05,.85],[.38,.71],[.51,.43],[.24,.51],[.05,.45],[.18,.22],[.77,.15],[1.02,0]],.15,P.water,0,0,-.075,.015);
    crest.name='wave-crest';
    line(g,[[-.45,.64,.095],[-.06,.85,.095],[.32,.72,.095],[.48,.48,.095]],.04,P.white);
  }else{
    const wide=kind==='long', width=wide?2.5:1.25;
    const points=[];
    for(let i=0;i<=16;i++){const t=i/16;points.push([(t-.5)*width,.055+Math.sin(t*Math.PI*4)*.04,Math.sin(t*Math.PI*4)*.08]);}
    const water=line(g,points,wide?.045:.035,P.water);water.name='wave-surface';
    if(wide)line(g,points.map(([x,y,z])=>[x*.78,y+.015,z+.22]),.018,P.white);
  }
  return finish(g,'water');
}

function ripple(size) {
  const g=group(), scale={small:.6,medium:.95,wide:1.4}[size];
  const outer=ovalRing(g,scale,scale*.48,.027,P.water,.027,0,0,.15,Math.PI*1.87);outer.name='ripple-outer';
  ovalRing(g,scale*.62,scale*.3,.027,0xbce9ff,.022,0,0,Math.PI*.72,Math.PI*2.5);
  if(size==='wide')ovalRing(g,scale*.82,scale*.39,.027,P.white,.014,0,0,Math.PI*1.08,Math.PI*1.73);
  return finish(g,'water');
}

function fountainBase() {
  const g=group();
  cylinder(g,1.03,1.1,.17,0xc7c3ba,0,.085,0,16);
  cylinder(g,1,1.03,.19,P.stone,0,.24,0,16);
  cylinder(g,.87,.87,.025,P.water,0,.345,0,24).name='water-surface';
  const rim=torus(g,.94,.09,P.stone,0,.35,0);rim.rotation.x=Math.PI/2;
  cylinder(g,.25,.37,.16,0xc7c3ba,0,.43,0);
  cylinder(g,.18,.24,.56,P.stone,0,.76,0);
  cylinder(g,.29,.22,.11,P.stone,0,1.065,0);
  ovalRing(g,.57,.57,.367,0xd4f0ff,.015,0,0,0,Math.PI*1.35);
  return finish(g,'water');
}

function fountainBowl() {
  const g=group();
  cylinder(g,.27,.35,.17,0xc7c3ba,0,.085,0);
  cylinder(g,.85,.28,.42,P.stone,0,.34,0,16);
  cylinder(g,.78,.78,.035,P.water,0,.56,0,24).name='water-surface';
  const rim=torus(g,.82,.065,P.stone,0,.57,0);rim.rotation.x=Math.PI/2;
  cylinder(g,.065,.1,.13,P.stone,0,.63,0);
  ovalRing(g,.35,.35,.59,P.white,.014,0,0,.2,Math.PI*1.6);
  return finish(g,'water');
}

function fountainJet() {
  const g=group(), jets=group();jets.name='fountain-jets';g.add(jets);
  line(jets,[[0,0,0],[.025,.65,0],[0,1.27,0]],.055,P.water);
  sphere(jets,.085,.14,.085,0xbce9ff,0,1.27,0);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,x=Math.cos(a),z=Math.sin(a);
    line(jets,[[0,.85,0],[x*.25,1.07,z*.25],[x*.55,.77,z*.55],[x*.67,.17,z*.67]],.028,P.water);
    sphere(jets,.047,.085,.047,P.water,x*.68,.06,z*.68);
  }
  for(const [x,y,z] of [[-.2,1.35,.1],[.26,1.2,-.1],[.05,1.55,0]])sphere(jets,.04,.08,.04,P.water,x,y,z);
  return finish(g,'water');
}

function bridge(kind) {
  const g=group(), arch=kind==='arch';
  if(kind==='rail'){
    for(let i=0;i<5;i++){const x=(i-2)*.65;box(g,.1,.83,.12,P.woodDark,x,.415,0);sphere(g,.09,.055,.09,P.wood,x,.88,0);}
    box(g,2.9,.1,.12,P.wood,0,.79,0);box(g,2.9,.075,.095,P.wood,0,.37,0);
    return finish(g);
  }
  const deckY=x=>arch?.23+.44*(1-(x/1.5)**2):.42;
  for(let i=0;i<15;i++){
    const x=(i-7)*.2, plank=box(g,.19,.105,1.1,i%3===0?P.woodDark:P.wood,x,deckY(x),0);
    plank.rotation.z=arch?Math.atan(-.88*x/2.25):0;
    for(const z of [-.42,.42]) sphere(g,.018,.011,.018,0x78533a,x,deckY(x)+.056,z);
  }
  for(const z of [-.44,.44]){
    if(arch){
      const points=[];for(let i=0;i<=12;i++){const x=-1.5+i*.25;points.push([x,deckY(x)-.09,z]);}line(g,points,.075,P.woodDark);
    }else box(g,3,.15,.13,P.woodDark,0,.3,z);
    for(const x of [-1.3,1.3])box(g,.14,deckY(x),.15,P.woodDark,x,deckY(x)/2,z);
  }
  if(arch){
    for(const z of [-.51,.51]){
      for(const x of [-1.4,-.7,0,.7,1.4])box(g,.085,.62,.085,P.woodDark,x,deckY(x)+.31,z);
      for(const offset of [.3,.61]){const points=[];for(let i=0;i<=12;i++){const x=-1.5+i*.25;points.push([x,deckY(x)+offset,z]);}line(g,points,.045,P.wood);}
    }
  }
  return finish(g);
}

const boatOutline=[[-1.32,0],[-1.05,-.37],[-.55,-.48],[.58,-.46],[1.42,0],[.58,.46],[-.55,.48],[-1.05,.37]];

function hull(g,color=P.wood) {
  const rings=[{s:.63,y:.035},{s:1,y:.51},{s:.86,y:.51},{s:.57,y:.22}], positions=[],indices=[];
  for(const ring of rings)for(const [x,z]of boatOutline)positions.push(x*ring.s,ring.y,z*ring.s);
  const n=boatOutline.length;
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<n;i++){
    const a=r*n+i,b=r*n+(i+1)%n,c=(r+1)*n+i,d=(r+1)*n+(i+1)%n;
    indices.push(a,b,c,b,d,c);
  }
  for(let i=1;i<n-1;i++)indices.push(3*n,3*n+i,3*n+i+1);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
  mesh(g,geo,color,0,0,0,{side:THREE.DoubleSide});
  const rim=boatOutline.map(([x,z])=>[x,.52,z]);rim.push(rim[0]);line(g,rim,.038,P.woodDark);
  for(const x of [-.57,.45])box(g,.22,.065,.75,P.wood,x,.41,0);
  for(const z of [-.22,0,.22])line(g,[[-.65,.225,z],[.63,.225,z]],.012,P.woodDark);
  for(const s of [-1,1])line(g,[[-.94,.36,s*.33],[-.3,.37,s*.41],[.59,.37,s*.38],[1.13,.38,s*.14]],.013,P.woodDark);
}

function boat(sailboat) {
  const g=group();hull(g,sailboat?0xf0c875:P.wood);
  if(sailboat){
    cylinder(g,.031,.041,1.99,P.woodDark,-.1,1.25,0);
    box(g,1.48,.045,.045,P.woodDark,.5,.76,0);
    const shape=new THREE.Shape();shape.moveTo(-.055,.81);shape.lineTo(-.055,2.22);shape.quadraticCurveTo(.48,1.46,1.16,.81);shape.closePath();
    mesh(g,new THREE.ExtrudeGeometry(shape,{depth:.03,bevelEnabled:false,curveSegments:10}),P.cream,0,0,-.015);
    const small=extrude(g,[[-.17,2.03],[-.17,.86],[-.98,.86]],.035,P.blue,0,0,-.02,0);small.name='sail';
    line(g,[[-.055,.91,.027],[.94,.91,.027]],.022,P.orange);
    line(g,[[-.1,2.2,0],[-1.1,.53,0]],.012,P.cream);
    extrude(g,[[-.1,2.23],[-.1,2.43],[.25,2.35]],.025,P.red,0,0,-.012,0);
  }else{
    for(const s of [-1,1]){
      const oar=group();oar.name=s===1?'oar-right':'oar-left';g.add(oar);
      line(oar,[[-.4,.52,s*.1],[-.08,.51,s*.46],[.58,.24,s*1.04]],.027,P.woodDark);
      const blade=sphere(oar,.12,.04,.29,P.wood,.7,.18,s*1.18);blade.rotation.y=s*.55;blade.rotation.z=-s*.12;
      cylinder(g,.04,.04,.09,P.metal,-.08,.55,s*.45);
    }
  }
  return finish(g,'boat');
}

function paperBoat() {
  const g=group();
  const vertices=[[-1.25,.58,0],[1.25,.58,0],[-.68,0,.37],[.68,0,.37],[0,.48,.46],[-.68,0,-.37],[.68,0,-.37],[0,.48,-.46],[0,1.12,0],[-.65,.44,0],[.65,.44,0]];
  const triangles=[[0,2,4],[2,3,4],[3,1,4],[0,7,5],[5,7,6],[6,7,1],[2,5,6],[2,6,3],[0,4,7],[1,7,4],[8,9,10],[8,10,9]];
  triangles.forEach((tri,i)=>{
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(tri.flatMap(n=>vertices[n]),3));geo.computeVertexNormals();
    mesh(g,geo,i%3===0?0xe9e6e0:P.white,0,0,0,{side:THREE.DoubleSide});
  });
  line(g,[[-1.25,.58,0],[0,.48,.46],[1.25,.58,0]],.012,0xb7b7b7);
  line(g,[[0,1.12,0],[0,.45,.015]],.011,0xc7c3ba);
  return finish(g,'boat');
}

function floatRing(duck) {
  const g=group();let ring;
  if(duck) ring=torus(g,.56,.18,P.yellow,0,.18,0);
  else {
    const geometry=new THREE.TorusGeometry(.56,.18,8,48).toNonIndexed(),position=geometry.attributes.position,colors=[];
    for(let i=0;i<position.count;i+=3){
      const x=(position.getX(i)+position.getX(i+1)+position.getX(i+2))/3,y=(position.getY(i)+position.getY(i+1)+position.getY(i+2))/3;
      const angle=((Math.atan2(y,x)+Math.PI*2)%(Math.PI/2));const color=new THREE.Color(angle<Math.PI/8?P.red:P.white);
      for(let j=0;j<3;j++)colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    ring=mesh(g,geometry,P.white,0,.18,0,{vertexColors:true});
  }
  ring.rotation.x=Math.PI/2;ring.name='float-body';
  if(duck){
    line(g,[[0,.2,.52],[0,.47,.64],[0,.75,.59]],.14,P.yellow);
    sphere(g,.26,.27,.25,P.yellow,0,.79,.6);
    sphere(g,.18,.06,.13,P.orange,0,.73,.83);
    for(const x of [-.16,.16])sphere(g,.037,.043,.024,P.ink,x,.85,.785);
    const tail=cone(g,.13,.29,P.yellow,0,.26,-.61);tail.rotation.x=-.65;
    for(const s of [-1,1])sphere(g,.14,.07,.25,0xf2ba3d,s*.55,.3,0);
  }else{
    ovalRing(g,.79,.79,.18,P.cream,.018);
  }
  return finish(g,'boat');
}

function buoy(channel) {
  const g=group(), color=channel?P.leaf:P.red;
  cylinder(g,.36,.43,.13,P.ink,0,.065,0);
  cylinder(g,.27,.35,.18,color,0,.21,0);
  if(channel){
    cylinder(g,.2,.2,.75,color,0,.65,0);cylinder(g,.205,.205,.18,P.white,0,.59,0);
    box(g,.43,.11,.43,color,0,1.06,0);box(g,.34,.07,.34,P.white,0,1.13,0);
  }else{
    cone(g,.29,.82,color,0,.71,0);cylinder(g,.16,.21,.17,P.white,0,.69,0);
  }
  const eye=torus(g,.065,.018,P.metal,0,channel?1.22:1.18,0);eye.name='mooring-ring';
  return finish(g,'boat');
}

function dock() {
  const g=group();
  for(let i=0;i<9;i++)box(g,.23,.1,1.15,i%3===0?P.woodDark:P.wood,(i-4)*.24,.42,0);
  for(const z of [-.4,.4])box(g,2.22,.14,.12,P.woodDark,0,.31,z);
  for(const x of [-.96,.96])for(const z of [-.48,.48]){
    cylinder(g,.085,.1,.82,P.woodDark,x,.41,z);
    cylinder(g,.105,.105,.055,P.wood,x,.84,z);
    for(const y of [.66,.71]){const rope=torus(g,.09,.017,P.cream,x,y,z);rope.rotation.x=Math.PI/2;}
  }
  for(const z of [-.39,.39])for(let i=0;i<9;i++)sphere(g,.018,.009,.018,P.metal,(i-4)*.24,.476,z);
  return finish(g);
}

export const waterFactories = {
  pond,
  'pond-edge-straight':()=>pondEdge('straight'), 'pond-edge-cove':()=>pondEdge('cove'), 'pond-edge-corner':()=>pondEdge('corner'), 'pond-edge-island':()=>pondEdge('island'),
  'wave-small':()=>wave('small'), 'wave-long':()=>wave('long'), 'wave-crest':()=>wave('crest'),
  'ripple-small':()=>ripple('small'), 'ripple-medium':()=>ripple('medium'), 'ripple-wide':()=>ripple('wide'),
  'fountain-base':fountainBase, 'fountain-bowl':fountainBowl, 'fountain-jet':fountainJet,
  'bridge-arch':()=>bridge('arch'), 'bridge-deck':()=>bridge('deck'), 'bridge-rail':()=>bridge('rail'),
  rowboat:()=>boat(false), sailboat:()=>boat(true), 'paper-boat':paperBoat,
  'float-ring':()=>floatRing(false), 'float-duck':()=>floatRing(true),
  'buoy-red':()=>buoy(false), 'buoy-channel':()=>buoy(true), 'dock-piece':dock,
};
