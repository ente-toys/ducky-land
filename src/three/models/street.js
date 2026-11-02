import { THREE, P, mat, group, box, sphere, cylinder, cone, line, extrude, leaf, label } from './primitives.js';
import { foodFactories } from './food.js';

const amber=0xffae2c;
function bench(park=false){
  const g=group();
  for(const x of [-.73,.73]){
    for(const z of [-.22,.25])box(g,.095,.49,.095,P.metal,x,.245,z);
    box(g,.08,.95,.08,P.metal,x,.52,-.25);
    box(g,.09,.36,.09,P.metal,x,.63,.21);
    box(g,.15,.075,.63,P.wood,x,.82,-.025);
  }
  for(let i=0;i<4;i++)box(g,1.88,.095,.13,P.wood,0,.5,-.25+i*.15);
  if(park){
    extrude(g,[[-.92,.67],[.92,.67],[.92,1.02],[.65,1.14],[0,1.2],[-.65,1.14],[-.92,1.02]],.09,P.leaf,0,0,-.34,.035);
    for(const x of [-.64,-.32,0,.32,.64])box(g,.027,.22,.014,P.leafDark,x,.88,-.238);
  }else for(const y of [.79,1.04])box(g,1.9,.18,.085,P.wood,0,y,-.29);
  return g;
}
function lamp(goose=false){
  const g=group();
  cylinder(g,.14,.22,.16,P.metal,0,.08,0);
  cylinder(g,.055,.09,2.1,P.metal,0,1.17,0);
  if(goose){
    line(g,[[0,2.15,0],[.04,2.4,0],[.38,2.54,0],[.64,2.37,0],[.65,2.21,0]],.048,0x565656);
    cone(g,.33,.22,P.metal,.65,2.16,0);
    cylinder(g,.29,.29,.04,P.cream,.65,2.04,0);
  }else{
    cylinder(g,.22,.15,.12,P.metal,0,2.13,0,4).rotation.y=Math.PI/4;
    box(g,.34,.47,.34,P.cream,0,2.4,0);
    for(const x of [-.19,.19])for(const z of [-.19,.19])box(g,.035,.49,.035,0x565656,x,2.4,z);
    cone(g,.35,.25,P.metal,0,2.77,0,4).rotation.y=Math.PI/4;
    sphere(g,.055,.07,.055,P.metal,0,2.94,0);
  }
  return g;
}
function sign(kind){
  const g=group();
  box(g,.12,1.48,.12,P.wood,0,.74,0);
  const boards=kind==='three-way'?[['POND',P.blue,1.5,1],['BREAD',amber,1.12,-1],['HOME',P.pink,.74,1]]:
    [[{bakery:'BREAD',park:'POND',welcome:'DUCKY LAND'}[kind],{bakery:amber,park:P.leaf,welcome:P.blue}[kind],1.35,1]];
  for(const [text,color,y,d] of boards){
    const p=group();g.add(p);p.position.y=y;
    const w=kind==='welcome'?1.9:1.35;
    const coords=[[-w*.5,-.17],[w*.32,-.17],[w*.5,0],[w*.32,.17],[-w*.5,.17]];
    extrude(p,coords.map(([x,y])=>[x*d,y]),.095,color,0,0,-.045,.025);
    label(p,text,w*.76,.23,-w*.05*d,0,.085,`#${color.toString(16).padStart(6,'0')}`,'#fff4c5');
    const rear=label(p,text,w*.76,.23,-w*.05*d,0,-.09,`#${color.toString(16).padStart(6,'0')}`,'#fff4c5');rear.rotation.y=Math.PI;
  }
  return g;
}
function fence(type){
  const g=group();
  for(const y of [.31,.77])box(g,2.25,.12,.11,P.wood,0,y,-.06);
  if(type==='picket')for(let i=0;i<7;i++)extrude(g,[[-.115,0],[.115,0],[.115,.94],[0,1.13],[-.115,.94]],.12,P.cream,-.99+i*.33,0,0,.015);
  else{
    for(const x of [-1.05,1.05]){
      box(g,.18,1.18,.18,P.wood,x,.59,0);
      cone(g,.15,.12,P.wood,x,1.23,0,4).rotation.y=Math.PI/4;
    }
    if(type==='gate'){
      const hinge=group();hinge.name='gate';g.add(hinge);
      for(const x of [-.65,-.22,.22,.65])box(hinge,.11,.85,.12,P.wood,x,.54,.07);
      line(hinge,[[-.85,.21,.15],[.85,.93,.15]],.04,P.woodDark);
      box(hinge,.2,.07,.06,amber,.76,.66,.18);
      for(const y of [.28,.8])box(g,.22,.055,.06,P.metal,-.95,y,.15);
    }
  }
  return g;
}
function bin(recycle=false){
  const g=group(),color=recycle?P.blue:P.leaf;
  box(g,.66,.86,.65,color,0,.43,0);
  box(g,.73,.13,.73,P.metal,0,.91,0);
  box(g,.39,.14,.04,P.ink,0,.78,.34);
  for(const x of [-.2,.2])box(g,.04,.55,.015,recycle?0x3471b8:P.leafDark,x,.35,.33);
  if(recycle){
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3,p=group();g.add(p);p.position.set(0,.43,.35);p.rotation.z=a;
      extrude(p,[[-.13,.13],[.08,.13],[.08,.19],[.19,.08],[.08,-.015],[.08,.045],[-.13,.045]],.014,P.cream,0,0,0,.002);
    }
  }else{
    box(g,.3,.33,.025,P.cream,0,.42,.35);
    box(g,.13,.13,.015,P.metal,0,.4,.37);
    for(const x of [-.045,.045])box(g,.013,.1,.015,P.cream,x,.4,.38);
    box(g,.17,.025,.015,P.metal,0,.49,.37);
  }
  return g;
}
function mailbox(){
  const g=group();
  box(g,.13,.86,.13,P.wood,0,.43,0);
  box(g,.66,.47,.54,P.red,0,1.02,0);
  sphere(g,.33,.22,.27,P.red,0,1.25,0);
  box(g,.42,.05,.025,P.ink,0,1.16,.28);
  label(g,'POST',.43,.17,0,.96,.286,'#f0463f','#fff4c5');
  box(g,.04,.5,.05,P.metal,.37,1.18,0);
  box(g,.22,.15,.05,P.yellow,.46,1.37,0);
  box(g,.59,.035,.055,P.woodDark,0,.8,.28);
  return g;
}
function bunting(){
  const g=group();g.userData.motion='cloth';
  line(g,[[-1.6,1.33,0],[-.8,1.05,.03],[0,.96,0],[.8,1.05,-.03],[1.6,1.33,0]],.018,P.ink);
  for(let i=0;i<9;i++){
    const x=-1.4+i*.35,y=.97+.34*(x/1.6)**2;
    const p=extrude(g,[[-.145,0],[.145,0],[.02,-.37]],.018,[P.red,amber,P.blue,P.purple,P.pink,P.leaf][i%6],x,y,0,.005);
    p.name=`pennant-${i}`;
    p.rotation.y=Math.sin(i)*.16;
  }
  return g;
}

function emblem(g,city,z){
  // City-specific reliefs copied from the original illustrated flock flags.
  const c=P.cream;
  if(city==='kochi'){
    line(g,[[-.32,-.06,z],[.29,.24,z],[-.14,.27,z],[-.32,-.06,z],[.34,-.06,z]],.021,c);
    line(g,[[-.03,-.13,z],[-.03,.31,z]],.021,c);
    for(let i=0;i<4;i++)line(g,[[-.27+i*.15,-.05,z],[-.17+i*.12,.15,z]],.009,c);
    for(let i=0;i<3;i++)line(g,[[-.22,-.03+i*.07,z],[.26,.0+i*.045,z]],.009,c);
  }else if(city==='chennai'){
    for(let i=0;i<4;i++)box(g,.55-i*.115,.09,.025,c,0,-.1+i*.1,z);
    box(g,.09,.13,.032,P.wood,0,-.08,z+(z>0?.018:-.018));
    sphere(g,.04,.04,.025,c,0,.31,z);
  }else if(city==='bengaluru'){
    line(g,[[0,-.16,z],[0,.28,z]],.025,c);
    for(const [x,y,a] of [[-.12,.08,.65],[.12,.19,-.65],[-.1,.27,.8]]){
      const l=sphere(g,.14,.065,.022,c,x,y,z);l.rotation.z=a;
    }
  }else if(city==='london'){
    box(g,.21,.43,.025,c,0,.04,z);
    const roof=extrude(g,[[-.15,0],[0,.2],[.15,0]],.025,amber,0,.25,z,.004);
    if(z<0)roof.position.z-=.025;
    cylinder(g,.087,.087,.025,P.white,0,.14,z+(z>0?.025:-.025)).rotation.x=Math.PI/2;
    line(g,[[0,.2,z+(z>0?.05:-.05)],[0,.14,z+(z>0?.05:-.05)],[.055,.14,z+(z>0?.05:-.05)]],.009,P.ink);
  }else if(city==='mumbai'||city==='delhi'||city==='hyderabad'){
    const hy=city==='hyderabad';
    for(const x of [-.2,.2])box(g,.12,hy?.49:.38,.025,c,x,.02,z);
    box(g,.44,.13,.025,c,0,.17,z);
    if(city==='delhi')box(g,.59,.08,.025,c,0,.28,z);
    else for(const x of [-.2,.2]){
      if(hy)sphere(g,.078,.085,.023,c,x,.31,z);
      else box(g,.15,.08,.025,c,x,.27,z);
    }
    line(g,[[-.135,-.16,z],[-.135,.025,z],[-.09,.13,z],[0,.17,z],[.09,.13,z],[.135,.025,z],[.135,-.16,z]],.025,c);
  }else{
    box(g,.62,.28,.025,c,0,.03,z);
    for(let i=0;i<5;i++)box(g,.075,.08,.025,c,-.27+i*.135,.2,z);
    box(g,.14,.19,.032,P.wood,0,-.015,z+(z>0?.02:-.02));
  }
}
function cityFlag(city){
  const g=group(),color={kochi:P.leaf,chennai:amber,bengaluru:P.purple,london:P.blue,mumbai:P.pink,delhi:P.red,hyderabad:P.orange,pune:P.leaf}[city];
  cylinder(g,.15,.19,.1,P.stone,-.7,.05,0);
  cylinder(g,.027,.038,2.17,P.metal,-.7,1.13,0);
  sphere(g,.062,.075,.062,amber,-.7,2.27,0);
  const cloth=group();cloth.name='flag-cloth';cloth.position.set(-.68,1.96,0);g.add(cloth);g.userData.motion='cloth';
  const geom=new THREE.PlaneGeometry(1.37,.9,12,4),a=geom.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i)+.685;a.setXYZ(i,x,a.getY(i),Math.sin(x*4.6)*.055);}
  geom.computeVertexNormals();const mesh=new THREE.Mesh(geom,mat(color,{side:THREE.DoubleSide}));mesh.castShadow=true;cloth.add(mesh);
  for(const z of [.085,-.085]){
    const badge=group();badge.position.set(.66,.01,z);cloth.add(badge);emblem(badge,city,z>0?.025:-.025);
    const text=label(cloth,city.toUpperCase(),1.12,.135,.67,-.3,z,`#${color.toString(16).padStart(6,'0')}`,'#fff4c5');
    if(z<0)text.rotation.y=Math.PI;
  }
  return g;
}
function umbrella(cafe=false){
  const g=group();
  cylinder(g,.22,.32,.12,P.stone,0,.06,0);
  cylinder(g,.035,.045,1.95,P.wood,0,1.06,0);
  const canopy=group();canopy.name='umbrella-canopy';g.add(canopy);g.userData.motion='cloth';
  const radius=1.13,top=2.27,edge=1.75;
  for(let panel=0;panel<8;panel++){
    const vertices=[];
    function point(r,a){return [Math.cos(a)*r,top-(top-edge)*Math.pow(r/radius,1.5)-.065*Math.sin((a-panel*Math.PI/4)*4)*(r/radius)**6,Math.sin(a)*r];}
    for(let ring=0;ring<3;ring++)for(let k=0;k<3;k++){
      const a=(panel+k/3)*Math.PI/4,b=(panel+(k+1)/3)*Math.PI/4,r0=radius*ring/3,r1=radius*(ring+1)/3;
      const p=point(r0,a),q=point(r1,a),r=point(r1,b),s=point(r0,b);
      vertices.push(...p,...r,...q,...p,...s,...r);
    }
    const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.computeVertexNormals();
    const m=new THREE.Mesh(geom,mat(cafe?P.leaf:P.pink,{side:THREE.DoubleSide}));m.castShadow=true;m.receiveShadow=true;canopy.add(m);
    const a=panel*Math.PI/4;line(canopy,[point(0,a),point(radius*.48,a),point(radius,a)],.014,P.cream);
  }
  sphere(g,.05,.09,.05,P.wood,0,2.32,0);
  return g;
}
function picnicTable(){
  const g=group();
  for(const x of [-.67,.67]){
    for(const s of [-1,1]){
      const leg=box(g,.11,1.03,.11,P.wood,x,.45,s*.31);leg.rotation.x=s*.45;
      box(g,.11,.44,.11,P.wood,x,.22,s*.83);
    }
    box(g,.11,.1,1.94,P.wood,x,.38,0);
  }
  for(let i=0;i<5;i++)box(g,2.1,.1,.16,P.wood,0,.94,-.36+i*.18);
  for(const z of [-.83,.83])for(const s of [-1,1])box(g,2.08,.095,.17,P.wood,0,.51,z+s*.09);
  box(g,1.5,.08,.1,P.woodDark,0,.42,0);
  return g;
}
function basket(){
  const g=group();
  box(g,.97,.53,.64,P.wood,0,.3,0);
  for(const y of [.12,.25,.38,.5]){
    for(const z of [-.327,.327])box(g,1,.035,.025,P.woodDark,0,y,z);
    for(const x of [-.5,.5])box(g,.025,.035,.65,P.woodDark,x,y,0);
  }
  for(let i=0;i<7;i++)for(const z of [-.345,.345])box(g,.027,.53,.025,P.woodDark,-.44+i*.145,.3,z);
  for(let i=0;i<4;i++)for(const x of [-.515,.515])box(g,.025,.53,.027,P.woodDark,x,.3,-.25+i*.17);
  box(g,1.06,.09,.73,P.wood,0,.6,0);
  line(g,[[-.44,.57,0],[-.41,.98,0],[0,1.16,0],[.41,.98,0],[.44,.57,0]],.045,P.woodDark);
  box(g,.14,.12,.035,amber,0,.52,.38);
  return g;
}
function blanket(){
  const g=group();g.userData.motion='cloth';
  box(g,2.1,.035,1.6,P.cream,0,.02,0);
  for(let i=0;i<5;i++){
    box(g,.1,.007,1.6,0xf4764e,-.84+i*.42,.042,0);
    box(g,2.1,.009,.1,0xf4764e,0,.043,-.63+i*.315);
  }
  const loaf=foodFactories.loaf();loaf.scale.setScalar(.35);loaf.position.set(-.42,.05,-.18);g.add(loaf);
  const apple=foodFactories.apple();apple.scale.setScalar(.32);apple.position.set(.54,.05,.27);g.add(apple);
  return g;
}
function planter(flowers){
  const g=group();g.userData.motion='vegetation';
  cylinder(g,.4,.29,.59,flowers?P.orange:P.purple,0,.295,0,12);
  cylinder(g,.45,.45,.1,flowers?P.orange:P.purple,0,.59,0,12);
  cylinder(g,.395,.395,.015,P.woodDark,0,.648,0,12);
  const crown=group();crown.name='vegetation';g.add(crown);
  if(flowers){
    for(let i=0;i<3;i++){
      const x=(i-1)*.24,y=1.07+(i%2)*.27,z=(i%2)*-.12;
      line(crown,[[x*.7,.64,z],[x,.88,z],[x,y,z]],.018,P.leafDark);
      leaf(crown,P.leaf,x+.1,.82,z,.14).rotation.z=.4;
      for(let k=0;k<5;k++){const a=k*Math.PI*.4;sphere(crown,.095,.105,.055,[P.pink,P.white,amber][i],x+Math.cos(a)*.115,y+Math.sin(a)*.115,z);}
      sphere(crown,.067,.067,.067,P.yellow,x,y,z+.03);
    }
  }else for(let i=0;i<7;i++){
    const a=i*2.4,x=Math.cos(a)*.25,z=Math.sin(a)*.23;
    line(crown,[[0,.65,0],[x,1,z],[x*1.3,1.15,z*1.3]],.018,P.leafDark);
    const l=sphere(crown,.13,.34,.05,i%2?P.leaf:P.leafDark,x,1.08,z);l.rotation.z=-Math.cos(a)*.65;l.rotation.y=-a;
  }
  return g;
}
function bollard(){const g=group();cylinder(g,.18,.23,.12,P.metal,0,.06,0);cylinder(g,.115,.14,.8,P.metal,0,.49,0);cylinder(g,.121,.121,.14,P.yellow,0,.73,0);sphere(g,.115,.09,.115,P.metal,0,.9,0);return g;}
function hydrant(){
  const g=group();cylinder(g,.27,.29,.12,P.metal,0,.06,0);cylinder(g,.2,.2,.77,P.red,0,.49,0);
  sphere(g,.24,.17,.24,P.red,0,.9,0);box(g,.09,.1,.09,P.metal,0,1.07,0);
  for(const s of [-1,1]){cylinder(g,.12,.12,.24,P.red,s*.25,.6,0).rotation.z=Math.PI/2;cylinder(g,.14,.14,.06,P.metal,s*.39,.6,0).rotation.z=Math.PI/2;}
  cylinder(g,.14,.14,.12,P.red,0,.43,.21).rotation.x=Math.PI/2;
  cylinder(g,.13,.13,.05,P.metal,0,.43,.3).rotation.x=Math.PI/2;
  return g;
}
function cycleRack(){
  const g=group();box(g,1.65,.09,.72,P.metal,0,.045,0);
  for(const x of [-.48,.48])line(g,[[x,.09,-.25],[x,.77,-.25],[x,.94,0],[x,.77,.25],[x,.09,.25]],.045,0x565656);
  return g;
}

export const streetFactories={
  'bench-wood':()=>bench(),'bench-park':()=>bench(true),'lamp-lantern':()=>lamp(),'lamp-gooseneck':()=>lamp(true),
  'sign-bakery':()=>sign('bakery'),'sign-park':()=>sign('park'),'sign-welcome':()=>sign('welcome'),'signpost-three-way':()=>sign('three-way'),
  'fence-picket':()=>fence('picket'),'fence-rail':()=>fence('rail'),'fence-gate':()=>fence('gate'),
  'bin-litter':()=>bin(),'bin-recycling':()=>bin(true),mailbox,bunting,
  ...Object.fromEntries(['kochi','chennai','bengaluru','london','mumbai','delhi','hyderabad','pune'].map(city=>[`flag-${city}`,()=>cityFlag(city)])),
  'umbrella-garden':()=>umbrella(),'umbrella-cafe':()=>umbrella(true),'picnic-table':picnicTable,
  'picnic-basket':basket,'picnic-blanket':blanket,'planter-flowers':()=>planter(true),'planter-leaf':()=>planter(false),
  bollard,hydrant,'cycle-rack':cycleRack,
};
