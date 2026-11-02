import { THREE, P, mat, group, box, sphere, cylinder, cone, torus, line, extrude, leaf } from './primitives.js';

// Solid, table-top food sculptures. Front and rear crumb/frosting details are
// geometry, so these stay readable when the town camera walks around them.
function bread(long = false, gold = false) {
  const g = group(), w = long ? 1.45 : .78, h = long ? .27 : .42;
  sphere(g, w, h, long ? .3 : .48, gold ? P.yellow : P.wood, 0, h, 0);
  for (const x of [-.48, 0, .48]) {
    const px = x * w;
    line(g, [[px-.12,h*1.66,.24],[px,h*1.98,0],[px+.12,h*1.66,-.24]], .026, P.cream);
  }
  return g;
}

function croissant() {
  const g = group(), positions=[], indices=[],steps=32,sides=12;
  // One continuous rolled crescent with a thick middle and pointed ends.
  function section(t,phi,extra=0){
    const a=-2.1+t*4.2,r=.025+.255*Math.pow(Math.sin(Math.PI*t),.75)+extra;
    const normal=new THREE.Vector2(-Math.sin(a)*.55,Math.cos(a)*.75).normalize();
    return [Math.sin(a)*.75+normal.x*Math.cos(phi)*r,.29+Math.sin(phi)*r*.85,-Math.cos(a)*.55+normal.y*Math.cos(phi)*r];
  }
  for(let i=0;i<=steps;i++)for(let j=0;j<=sides;j++)positions.push(...section(i/steps,j/sides*Math.PI*2));
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){
    const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
  const pastry=new THREE.Mesh(geo,mat(0xffae2c,{side:THREE.DoubleSide}));pastry.castShadow=pastry.receiveShadow=true;g.add(pastry);
  for(const a of [-2.1,2.1])sphere(g,.027,.024,.027,0xffae2c,Math.sin(a)*.75,.29,-Math.cos(a)*.55);
  for(const t of [.19,.34,.5,.66,.81]){
    const pts=[];for(let i=0;i<=12;i++)pts.push(section(t,i/12*Math.PI,.006));
    line(g,pts,.014,P.woodDark);
  }
  return g;
}

function slice() {
  const g = group();
  const contour = [[-.5,0],[.5,0],[.53,.6],[.65,.73],[.62,.93],[.42,1.05],[0,1.09],[-.42,1.05],[-.62,.93],[-.65,.73],[-.53,.6]];
  extrude(g, contour, .23, P.wood, 0, .035, -.115, .05);
  for (const z of [-.167,.167]) {
    const c = extrude(g, contour.map(([x,y])=>[x*.82,y*.82]), .012, P.cream, 0,.12,z, .025);
    if (z < 0) c.position.z -= .012;
    for (const [x,y,r] of [[-.22,.35,.035],[.18,.63,.047],[-.16,.8,.032],[.32,.34,.025]])
      sphere(g,r,r,.008,0xf6e3a7,x,y,z+(z>0?.022:-.022));
  }
  return g;
}

function egg(gold = false) {
  const g = group();
  // Lower belly and narrower crown, with a smooth closed rotational profile.
  const pts = [[0,0],[.24,.025],[.42,.18],[.49,.42],[.47,.67],[.37,.94],[.21,1.14],[0,1.21]];
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),20),
    new THREE.MeshToonMaterial({color:gold ? P.yellow : P.white}));
  mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
  sphere(g,.06,.16,.015,gold?P.cream:P.white,-.22,.83,.35).rotation.z=-.3;
  return g;
}

function iceCream(swirl = false) {
  const g = group();
  const c=cone(g,.31,.87,P.wood,0,.435,0);c.rotation.z=Math.PI;
  for (let k=0;k<6;k++) {
    const a=k*Math.PI/3;
    line(g,[[Math.cos(a)*.06,.16,Math.sin(a)*.06],
      [Math.cos(a+.55)*.19,.52,Math.sin(a+.55)*.19],
      [Math.cos(a+1.1)*.295,.82,Math.sin(a+1.1)*.295]],.012,P.woodDark);
  }
  const rim=torus(g,.3,.025,P.woodDark,0,.86,0);rim.rotation.x=Math.PI/2;
  if(swirl) {
    const pts=[];
    for(let i=0;i<=66;i++) { const t=i/66, a=t*Math.PI*6.5, r=.29*(1-t);
      pts.push([Math.cos(a)*r,.95+t*.63,Math.sin(a)*r]); }
    line(g,pts,.105,P.cream);
    sphere(g,.24,.18,.24,P.cream,0,.93,0);
  } else {
    sphere(g,.38,.34,.36,P.pink,0,.99,0);
    sphere(g,.32,.31,.31,P.cream,.035,1.43,0);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;sphere(g,.09,.08,.09,P.pink,Math.cos(a)*.31,.86,Math.sin(a)*.31);}
  }
  return g;
}

function fruit(pear = false) {
  const g = group();
  if(pear) {
    sphere(g,.48,.45,.43,P.grass,0,.45,0);
    sphere(g,.27,.41,.26,P.grass,.035,.83,0);
  } else {
    sphere(g,.4,.43,.42,P.red,-.18,.45,0);
    sphere(g,.4,.43,.42,P.red,.18,.45,0);
  }
  const y=pear?1.15:.84;
  line(g,[[0,y,0],[.045,y+.17,0],[.12,y+.25,-.015]],.035,P.woodDark);
  const l=leaf(g,P.leaf,.22,y+.17,0,.23);l.rotation.z=.2;
  return g;
}

function cherries() {
  const g=group();
  sphere(g,.3,.31,.3,P.red,-.32,.31,.02);
  sphere(g,.3,.31,.3,P.red,.31,.31,-.04);
  line(g,[[-.32,.57,.02],[-.23,1.03,0],[.06,1.24,0]],.025,P.leafDark);
  line(g,[[.31,.57,-.04],[.28,1.04,0],[.06,1.24,0]],.025,P.leafDark);
  const l=leaf(g,P.leaf,.31,1.19,.015,.28);l.rotation.z=-.18;
  return g;
}

function donut() {
  const g=group();
  const dough=torus(g,.46,.22,P.wood,0,.23,0);dough.rotation.x=Math.PI/2;
  const icing=torus(g,.46,.18,P.pink,0,.32,0);icing.rotation.x=Math.PI/2;icing.scale.z=.65;
  for(let i=0;i<14;i++){
    const a=i*2.39996,r=.44+(i%3-1)*.08;
    const s=box(g,.08,.022,.024,[P.cream,P.yellow,P.blue][i%3],Math.cos(a)*r,.44,Math.sin(a)*r);
    s.rotation.y=a*.7;
  }
  return g;
}

function pretzel() {
  const g=group();
  const pts=[[-.47,.16,-.27],[-.78,.16,.05],[-.7,.16,.49],[-.36,.16,.62],[0,.19,.35],
    [.42,.16,-.36],[.75,.16,-.03],[.68,.16,.48],[.34,.16,.6],[0,.29,.3],[-.44,.28,-.38]];
  line(g,pts,.14,P.wood);
  for (const [x,z] of [[-.67,.25],[-.38,.53],[.61,.33],[.32,.48],[-.25,-.19],[.31,-.19]])
    box(g,.055,.025,.03,P.cream,x,.31,z).rotation.y=x*3;
  return g;
}

function cupcake() {
  const g=group();
  cylinder(g,.44,.3,.57,P.purple,0,.285,0,16);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;line(g,[[Math.cos(a)*.3,.04,Math.sin(a)*.3],[Math.cos(a)*.43,.55,Math.sin(a)*.43]],.014,0x6f57c2);}
  sphere(g,.46,.2,.46,P.pink,0,.65,0);
  const pts=[];for(let i=0;i<=48;i++){const t=i/48,a=t*Math.PI*5.5,r=.31*(1-t);pts.push([r*Math.cos(a),.75+t*.4,r*Math.sin(a)]);}
  line(g,pts,.12,P.pink);
  sphere(g,.12,.12,.12,P.red,0,1.2,0);
  line(g,[[0,1.28,0],[.02,1.39,0],[.08,1.42,0]],.014,P.leafDark);
  return g;
}

function seedBag() {
  const g=group();
  sphere(g,.49,.47,.29,P.cream,0,.46,0);
  cylinder(g,.27,.35,.17,P.cream,0,.94,0,8);
  const tie=torus(g,.25,.025,P.woodDark,0,.93,0);tie.rotation.x=Math.PI/2;tie.scale.y=.65;
  box(g,.48,.36,.025,P.wood,0,.47,.29);
  for(const [x,y,a] of [[-.13,.45,-.45],[0,.56,.2],[.13,.42,.5]]){
    const s=sphere(g,.055,.1,.025,0xffae2c,x,y,.32);s.rotation.z=a;
  }
  return g;
}

export const foodFactories={
  loaf:()=>bread(), baguette:()=>bread(true), croissant, 'bread-slice':slice,
  'golden-bread':()=>bread(false,true), egg:()=>egg(), 'golden-egg':()=>egg(true),
  'ice-cream-double':()=>iceCream(), 'ice-cream-swirl':()=>iceCream(true),
  apple:()=>fruit(), pear:()=>fruit(true), cherries, donut, pretzel, cupcake, 'seed-bag':seedBag,
};
