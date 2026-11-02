import { THREE, P, group, sphere, cylinder, cone, torus, line, extrude, leaf, mesh } from './primitives.js';

const bark = 0x8d542e;
const mint = 0x6bc94a;

function grounded(g, motion) {
  g.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(g);
  for (const child of g.children) child.position.y -= bounds.min.y;
  if (motion) g.userData.motion = motion;
  return g;
}

function branch(g, from, to, radius = .09, color = P.wood) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const part = cylinder(g, radius * .62, radius, a.distanceTo(b), color);
  part.position.copy(a).add(b).multiplyScalar(.5);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return part;
}

function treeTrunk(g, height = 1.85, width = .19) {
  cylinder(g, width * .65, width, height, P.wood, 0, height / 2, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    branch(g, [0, .28, 0], [Math.cos(a) * width * 2.3, .035, Math.sin(a) * width * 2.3], width * .45);
  }
  branch(g, [0, height * .55, 0], [-.63, height, -.05], width * .58);
  branch(g, [.03, height * .65, 0], [.58, height * 1.1, .03], width * .52);
  line(g, [[-.06, .2, width * .95], [-.04, .55, width * .87], [-.08, 1.03, width * .75]], .012, bark);
  const knot = torus(g, .055, .014, bark, .06, .73, width * .89); knot.scale.set(.65, 1, 1);
}

function foliage(g, style = 'oak', color = P.leaf) {
  const crown = group(); crown.name = 'canopy'; g.add(crown);
  if (style === 'round') {
    sphere(crown, .91, .97, .85, color, 0, 2.15, 0);
    sphere(crown, .25, .19, .12, mint, -.42, 2.67, .66);
  } else {
    const lobes = [[-.66, 1.93, 0, .63], [.64, 1.98, 0, .64], [0, 2.42, -.11, .73], [-.25, 2.16, .43, .65], [.38, 2.22, .34, .57], [0, 2.0, -.52, .65]];
    lobes.forEach(([x, y, z, r], i) => sphere(crown, r, r * .92, r * .88, i === 5 ? P.leafDark : color, x, y, z));
    for (const [x, y, z] of [[-.75, 2.23, .44], [.15, 2.77, .26], [.55, 2.4, .56]]) {
      leaf(crown, mint, x, y, z, .18).rotation.x = .65;
    }
  }
  return crown;
}

function bread(g, kind, x, y, z, angle) {
  const pastry = group(); pastry.position.set(x, y, z); pastry.rotation.z = angle; g.add(pastry);
  if (kind === 'baguette') {
    sphere(pastry, .115, .37, .11, 0xeda94d, 0, 0, 0);
    for (let i = -1; i <= 1; i++) {
      const slash = sphere(pastry, .085, .024, .019, P.cream, 0, i * .16, .1); slash.rotation.z = -.42;
    }
  } else {
    const curve = new THREE.EllipseCurve(0, 0, .23, .17, .1 * Math.PI, .9 * Math.PI, false, 0);
    const pts = curve.getPoints(12);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], r = .035 + .065 * Math.sin(Math.PI * i / (pts.length - 1));
      sphere(pastry, r * 1.13, r, r, i % 3 === 0 ? P.wood : 0xeab25a, p.x, p.y, 0);
    }
  }
}

function broadTree(kind) {
  const g = group(); treeTrunk(g); const crown = foliage(g, kind === 'round' ? 'round' : 'oak', kind === 'blossom' ? 0xf58eb5 : P.leaf);
  if (kind === 'baguette' || kind === 'croissant') {
    [[-.71, 1.84, .54, -.4], [.66, 2.15, .56, .45], [.06, 2.73, .43, -.25], [-.13, 2.06, .91, .3]].forEach(p => bread(crown, kind, ...p));
  }
  if (kind === 'blossom') {
    [[-.8, 2.2, .46], [.43, 2.67, .4], [.7, 1.98, .59], [-.12, 2.05, .94], [-.2, 2.85, .25]].forEach(p => bloom(crown, P.white, P.yellow, .13, ...p, 5));
  }
  return grounded(g, 'vegetation');
}

function willow() {
  const g = group(); treeTrunk(g, 1.92, .17);
  const crown = group(); crown.name = 'canopy'; g.add(crown);
  sphere(crown, 1.05, .55, .86, P.leaf, 0, 2.25, 0);
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9, x = Math.cos(a) * .83, z = Math.sin(a) * .69;
    const h = .7 + (i % 3) * .15;
    sphere(crown, .28, h, .28, i % 2 ? P.leaf : mint, x, 1.9, z);
    line(crown, [[x * .65, 2.43, z * .65], [x, 1.9, z + .19], [x * 1.02, 1.9 - h * .8, z + .14]], .014, P.leafDark);
  }
  return grounded(g, 'vegetation');
}

function banyan() {
  const g = group(); treeTrunk(g, 1.65, .27);
  branch(g, [-.07, .45, -.12], [-.3, 1.85, -.1], .14);
  for (const x of [-1.05, -.65, .63, 1.08]) {
    branch(g, [0, 1.5, 0], [x, 1.85, .05], .13);
    line(g, [[x, 1.93, .02], [x * .96, 1, .11], [x * 1.04, .025, .13]], .047, P.woodDark);
  }
  const crown = group(); crown.name = 'canopy'; g.add(crown);
  for (let i = 0; i < 5; i++) sphere(crown, .65, .55 + (i === 2 ? .15 : 0), .77, i === 0 ? P.leafDark : P.leaf, (i - 2) * .48, 2.03 + Math.sin(i / 4 * Math.PI) * .2, 0);
  return grounded(g, 'vegetation');
}

function pine() {
  const g = group(); treeTrunk(g, 1.5, .16);
  const crown = group(); crown.name = 'canopy'; g.add(crown);
  [[.96, 1.35, 1.3], [.75, 1.3, 1.91], [.49, 1.15, 2.45]].forEach(([r,h,y], i) => cone(crown, r, h, i === 0 ? P.leafDark : P.leaf, 0, y, 0, 10));
  return grounded(g, 'vegetation');
}

function palm(coconuts) {
  const g = group();
  line(g, [[-.27, .04, 0], [-.24, .65, 0], [0, 1.5, 0], [.12, 2.35, 0]], .125, P.wood);
  for (let i = 0; i < 9; i++) {
    const y = .16 + i * .235, x = y < .65 ? -.26 : -.26 + (y - .65) * .22;
    const ring = torus(g, .125, .017, P.woodDark, x, y, 0); ring.rotation.x = Math.PI / 2;
  }
  const crown = group(); crown.name = 'canopy'; crown.position.set(.12, 2.3, 0); g.add(crown);
  for (let i = 0; i < 7; i++) {
    const frond = group(); frond.rotation.y = i * Math.PI * 2 / 7; crown.add(frond);
    const vertices = [], indices = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8, x = t * 1.32, y = Math.sin(t * Math.PI) * .35 - t * .35, w = Math.sin(t * Math.PI) * .22;
      vertices.push(x, y, -w, x, y + .06, 0, x, y, w);
      if (j < 8) for (let k = 0; k < 2; k++) { const a = j * 3 + k; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    mesh(frond, geo, i % 2 ? P.leaf : P.leafDark, 0, 0, 0, { side: THREE.DoubleSide });
    line(frond, [[0, .01, 0], [.45, .18, 0], [.92, -.04, 0], [1.32, -.35, 0]], .017, mint);
  }
  if (coconuts) [[-.11, -.14, .09], [.14, -.17, .12], [.03, -.1, -.16]].forEach(p => sphere(crown, .16, .19, .15, bark, ...p));
  return grounded(g, 'vegetation');
}

function bloom(g, color, centre, radius, x, y, z, petals = 8) {
  const head = group(); head.position.set(x, y, z); g.add(head);
  for (let i = 0; i < petals; i++) {
    const a = i * Math.PI * 2 / petals;
    const p = sphere(head, radius * .38, radius * .72, radius * .19, color, Math.sin(a) * radius * .7, Math.cos(a) * radius * .7, 0);
    p.rotation.z = -a;
  }
  sphere(head, radius * .38, radius * .38, radius * .25, centre, 0, 0, radius * .13);
  return head;
}

function bush(kind) {
  const g = group(), wide = kind === 'wide';
  const crown = group(); crown.name = 'canopy'; g.add(crown);
  [[-.42, .39, 0, .46], [0, .49, -.03, .57], [.43, .36, .07, .43]].forEach(([x,y,z,r], i) => sphere(crown, r * (wide ? 1.55 : 1), r * (wide ? .72 : 1), r * .86, i === 0 ? P.leafDark : P.leaf, x * (wide ? 1.5 : 1), y * (wide ? .8 : 1), z));
  if (kind === 'berry') for (const [x,y,z] of [[-.48,.52,.37],[.05,.69,.43],[.45,.45,.39],[-.1,.32,.5]]) {
    sphere(crown, .085, .085, .08, P.red, x,y,z); sphere(crown, .024,.024,.015,P.pink,x-.025,y+.03,z+.065);
  }
  if (kind === 'flowering') [[-.48,.59,.36],[.06,.76,.44],[.48,.5,.38]].forEach(p => bloom(crown,P.pink,P.yellow,.14,...p,5));
  return grounded(g, 'vegetation');
}

function flower(g, kind, x = 0, z = 0, height = 1) {
  const stalk = group(); stalk.position.set(x, 0, z); g.add(stalk);
  line(stalk, [[0,0,0],[-.025,height*.45,0],[.04,height,0]],.028,P.leafDark);
  const l = leaf(stalk,P.leaf,-.15,height*.4,0,.23); l.rotation.z = -.45;
  const r = leaf(stalk,P.leaf,.14,height*.58,-.01,.22); r.rotation.z = .65;
  let head;
  if (kind === 'tulip') {
    head = group(); head.position.set(.04,height,0); stalk.add(head);
    sphere(head,.18,.22,.18,P.pink,0,0,0);
    for (let i=0;i<5;i++) { const a=i*Math.PI*2/5; const p=sphere(head,.115,.2,.07,i%2?0xe04a80:P.pink,Math.sin(a)*.11,.09,Math.cos(a)*.11); p.rotation.z=-Math.sin(a)*.15; p.rotation.x=Math.cos(a)*.15; }
  } else {
    const colors = { daisy:P.white, poppy:P.red, pink:P.pink, sunflower:0xffba2d };
    const r = kind === 'sunflower' ? .36 : kind === 'poppy' ? .28 : .25;
    if (kind === 'poppy') {
      head = group(); head.position.set(.04,height,0); stalk.add(head);
      for(let i=0;i<4;i++) { const a=i*Math.PI/2+.3; const petal=sphere(head,.19,.22,.065,i%2?0xf85b4c:P.red,Math.sin(a)*.13,Math.cos(a)*.13,0); petal.rotation.z=-a; }
      sphere(head,.085,.085,.055,P.ink,0,0,.075);
    } else head = bloom(stalk,colors[kind] || P.pink,kind==='sunflower'?bark:P.yellow,r,.04,height,0,kind==='sunflower'?12:8);
    if (kind === 'sunflower') {
      sphere(head,.17,.17,.06,bark,0,0,.065);
      for(let i=0;i<9;i++){const a=i*2.4, d=.033*Math.sqrt(i);sphere(head,.018,.018,.012,0xe3a640,Math.cos(a)*d,Math.sin(a)*d,.13);}
    }
    head.rotation.x = -.35;
  }
  head.name = 'flower-head';
}

function flowerModel(kind) {
  const g = group();
  if (kind==='cluster') { flower(g,'pink',-.35,.06,.7); flower(g,'daisy',.02,-.12,1.1); flower(g,'poppy',.34,.1,.83); }
  else flower(g,kind,0,0,kind==='sunflower'?1.35:1);
  return grounded(g,'vegetation');
}

function rock(kind) {
  const g = group(), dimensions = {round:[.65,.49,.55], boulder:[.95,.8,.72], upright:[.4,1.15,.43], flat:[.85,.2,.65]}[kind];
  const shape = new THREE.DodecahedronGeometry(1,0);
  const stone = mesh(g,shape,kind==='boulder'?0xc7c3ba:P.stone); stone.scale.set(...dimensions); stone.rotation.set(.17,.36,.08);
  if(kind==='boulder') { const companion=mesh(g,new THREE.DodecahedronGeometry(1,0),P.stone,.68,-.42,.3); companion.scale.set(.25,.26,.3); }
  if(kind==='flat') line(g,[[-.5,.2,.1],[-.1,.23,.15],[.28,.21,.04]],.014,0xb7b7b7);
  return grounded(g);
}

function grass(kind) {
  const g=group(), count=kind==='three'?3:kind==='wide'?7:5;
  for(let i=0;i<count;i++) {
    const x=(i-(count-1)/2)*.105, lean=(i-(count-1)/2)*.16, h=.48+Math.sin(i*2.1+1)*.16;
    if(kind==='curl' && i===count-1) { line(g,[[x,0,0],[x+.3,.45,0],[x+.15,.67,0],[x-.02,.55,0]],.035,P.leaf); continue; }
    const blade=extrude(g,[[x-.045,0],[x+lean*.55,h*.65],[x+lean,h],[x+lean*.23,h*.35],[x+.055,0]],.035,i%2?P.leafDark:P.leaf,0,0,(i%3)*.09,0);
    blade.rotation.y=(i%2-.5)*.6;
  }
  return grounded(g,'vegetation');
}

function mushroom(g,x,z,size,color) {
  const m=group(); m.position.set(x,0,z); m.scale.setScalar(size); g.add(m);
  cylinder(m,.13,.19,.53,P.cream,0,.27,0);
  const cap=mesh(m,new THREE.SphereGeometry(.5,12,6,0,Math.PI*2,0,Math.PI/2),color,0,.5,0); cap.scale.y=.72;
  cylinder(m,.49,.47,.055,0xf6e3a7,0,.49,0);
  for(const [a,h] of [[.4,.5],[2,.7],[3.7,.45],[5.1,.7]]) {
    const r=Math.sin(h)*.505, y=.5+Math.cos(h)*.36;
    const spot=sphere(m,.09,.022,.08,P.cream,Math.cos(a)*r,y,Math.sin(a)*r); spot.rotation.z=-Math.cos(a)*h; spot.rotation.x=Math.sin(a)*h;
  }
}

function mushroomModel(kind) {
  const g=group();
  if(kind==='cluster'){mushroom(g,-.36,0,.75,P.red);mushroom(g,.16,-.14,1,P.red);mushroom(g,.48,.24,.55,P.purple);}
  else mushroom(g,0,0,1,kind==='red'?P.red:P.purple);
  return grounded(g);
}

function lily(flowered,large) {
  const g=group(), radius=large?.83:.56;
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(Math.cos(.17)*radius,Math.sin(.17)*radius);shape.absarc(0,0,radius,.17,Math.PI*2-.17,false);shape.lineTo(0,0);
  const pad=mesh(g,new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:false,curveSegments:20}),P.leaf);pad.rotation.x=-Math.PI/2;
  for(const a of [.55,1.7,2.7,4,5.2]) line(g,[[0,.05,0],[Math.cos(a)*radius*.43,.05,Math.sin(a)*radius*.43],[Math.cos(a)*radius*.82,.05,Math.sin(a)*radius*.82]],.009,P.leafDark);
  if(flowered) {
    for(let layer=0;layer<2;layer++) for(let i=0;i<7;i++) {
      const a=i*Math.PI*2/7+layer*.4, d=layer?.1:.19;
      const petal=sphere(g,.11,.07,.22,layer?0xffa7ca:P.pink,Math.sin(a)*d,.13+layer*.09,Math.cos(a)*d);petal.rotation.y=a;petal.rotation.x=-.22;
    }
    sphere(g,.12,.08,.12,P.yellow,0,.26,0);
  }
  return grounded(g,'water');
}

function reeds(cattails) {
  const g=group();
  for(let i=0;i<5;i++){
    const x=(i-2)*.19,z=Math.sin(i*2)*.15,h=.9+(i%3)*.26;
    line(g,[[x,0,z],[x+.02,h*.5,z],[x+(i-2)*.025,h,z]],.022,P.leafDark);
    if(cattails){cylinder(g,.065,.065,.32,bark,x+(i-2)*.025,h-.05,z);cone(g,.024,.12,P.woodDark,x+(i-2)*.025,h+.17,z);}
    for(const s of [-1,1]){
      const blade=extrude(g,[[0,0],[s*.13,.48],[s*.29,.76],[s*.24,.42],[.035,0]],.022,P.leaf,x,.05,z,0);blade.rotation.y=i*.8;
    }
  }
  return grounded(g,'vegetation');
}

function log(stump) {
  const g=group();
  if(stump){
    cylinder(g,.42,.55,.67,P.woodDark,0,.335,0,10);cylinder(g,.41,.41,.025,P.wood,0,.68,0,10);
    for(const r of [.13,.26,.36]){const ring=torus(g,r,.012,bark,0,.7,0);ring.rotation.x=Math.PI/2;}
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;branch(g,[Math.cos(a)*.28,.26,Math.sin(a)*.28],[Math.cos(a)*.72,.04,Math.sin(a)*.72],.14,P.woodDark);}
    branch(g,[.31,.37,-.05],[.66,.67,-.06],.13,P.woodDark);
  }else{
    const trunk=cylinder(g,.32,.36,1.8,P.woodDark,0,.36,0,12);trunk.rotation.z=Math.PI/2;
    for(const s of [-1,1]){
      const end=cylinder(g,.31,.31,.018,P.wood,s*.91,.36,0,12);end.rotation.z=Math.PI/2;
      for(const r of [.1,.21,.28]){const ring=torus(g,r,.013,bark,s*.925,.36,0);ring.rotation.y=Math.PI/2;}
    }
    for(const z of [-.22,0,.22])line(g,[[-.77,.58,z],[-.23,.66,z],[.32,.64,z],[.73,.58,z]],.02,bark);
    branch(g,[.1,.54,-.1],[.35,.91,-.21],.12,P.woodDark);
  }
  return grounded(g);
}

export const natureFactories = {
  'tree-oak':()=>broadTree('oak'), 'tree-round':()=>broadTree('round'), 'tree-willow':willow, 'tree-banyan':banyan,
  'tree-baguette':()=>broadTree('baguette'), 'tree-croissant':()=>broadTree('croissant'), 'tree-blossom':()=>broadTree('blossom'),
  'tree-pine':pine, 'tree-palm':()=>palm(false), 'tree-coconut-palm':()=>palm(true),
  'bush-round':()=>bush('round'), 'bush-wide':()=>bush('wide'), 'bush-berry':()=>bush('berry'), 'bush-flowering':()=>bush('flowering'),
  'flower-daisy':()=>flowerModel('daisy'), 'flower-poppy':()=>flowerModel('poppy'), 'flower-pink':()=>flowerModel('pink'),
  'flower-sunflower':()=>flowerModel('sunflower'), 'flower-cluster':()=>flowerModel('cluster'), 'flower-tulip':()=>flowerModel('tulip'),
  'rock-round':()=>rock('round'), 'rock-boulder':()=>rock('boulder'), 'rock-upright':()=>rock('upright'), 'rock-flat':()=>rock('flat'),
  'grass-tuft-three':()=>grass('three'), 'grass-tuft-wide':()=>grass('wide'), 'grass-tuft-curl':()=>grass('curl'),
  'mushroom-red':()=>mushroomModel('red'), 'mushroom-purple':()=>mushroomModel('purple'), 'mushroom-cluster':()=>mushroomModel('cluster'),
  'lily-pad-small':()=>lily(false,false), 'lily-pad-large':()=>lily(false,true), 'lily-pad-flower':()=>lily(true,true),
  reeds:()=>reeds(false), cattails:()=>reeds(true), log:()=>log(false), stump:()=>log(true),
};
