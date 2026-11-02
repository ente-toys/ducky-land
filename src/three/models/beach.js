import { THREE, P, mat, group, box, sphere, cylinder, cone, torus, line, extrude } from './primitives.js';

function groundShape(g,points,height,color){
  const m=extrude(g,points,height,color,0,height,0,.025);m.rotation.x=Math.PI/2;return m;
}
function sandEdge(type){
  const g=group();
  const shapes={
    bank:[[-1.55,-.56],[-1.1,-.72],[-.64,-.62],[-.15,-.73],[.39,-.61],[.89,-.69],[1.55,-.55],[1.53,.44],[1.13,.6],[.62,.54],[.12,.7],[-.4,.61],[-.9,.68],[-1.5,.48]],
    cove:[[-1.5,-.68],[-.98,-.88],[-.41,-.82],[.13,-.78],[.7,-.87],[1.32,-.65],[1.54,-.24],[1.5,.7],[1.1,.8],[.93,.31],[.7,.05],[.24,-.13],[-.23,-.11],[-.73,.12],[-.93,.57],[-1.36,.69],[-1.53,.17]],
    island:[[-1.54,-.05],[-1.37,-.57],[-.84,-.79],[-.25,-.83],[.32,-.71],[.95,-.67],[1.43,-.32],[1.53,.19],[1.21,.61],[.68,.8],[.1,.77],[-.47,.83],[-1.08,.58],[-1.49,.24]],
  };
  groundShape(g,shapes[type],.16,P.cream);
  for(const [x,z] of [[-.9,-.3],[-.68,-.42],[.28,-.45],[.42,-.39],[1.12,.03],[1.16,.16]])sphere(g,.035,.012,.025,P.wood,x,.195,z);
  return g;
}
function scallop(){
  const g=group(),positions=[];
  function at(r,a){const edge=1+.045*Math.cos(a*12);return [Math.sin(a)*r*.74*edge,.075+.22*Math.sin(Math.PI*r*.82),.43-Math.cos(a)*r*.98*edge];}
  for(let ring=0;ring<5;ring++)for(let wedge=0;wedge<16;wedge++){
    const a=-Math.PI/2+wedge*Math.PI/16,b=a+Math.PI/16;
    const p=at(ring/5,a),q=at((ring+1)/5,a),r=at((ring+1)/5,b),s=at(ring/5,b);
    positions.push(...p,...r,...q,...p,...s,...r);
  }
  for(let i=0;i<16;i++){
    const p=at(1,-Math.PI/2+i*Math.PI/16),q=at(1,-Math.PI/2+(i+1)*Math.PI/16),a=[p[0],.055,p[2]],b=[q[0],.055,q[2]];
    positions.push(...p,...a,...b,...p,...b,...q);
  }
  for(const angle of [-Math.PI/2,Math.PI/2])for(let i=0;i<5;i++){
    const p=at(i/5,angle),q=at((i+1)/5,angle),a=[p[0],.055,p[2]],b=[q[0],.055,q[2]];
    positions.push(...p,...a,...b,...p,...b,...q);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,mat(P.pink,{side:THREE.DoubleSide}));m.castShadow=m.receiveShadow=true;g.add(m);
  const outline=[[0,.43]];for(let i=0;i<=16;i++){const p=at(1,-Math.PI/2+i*Math.PI/16);outline.push([p[0],p[2]]);}
  groundShape(g,outline,.055,P.pink);
  for(let k=0;k<7;k++){
    const a=-1.35+k*.45,pts=[];for(let j=0;j<=6;j++){const p=at(.1+j*.15,a);p[1]+=.012;pts.push(p);}line(g,pts,.012,0xe04a80);
  }
  sphere(g,.19,.08,.1,P.pink,0,.09,.45);
  return g;
}
function conch(){
  const g=group();
  sphere(g,.54,.34,.36,P.cream,.17,.35,0);
  const tip=cone(g,.28,.85,P.cream,-.47,.31,0,16);tip.rotation.z=Math.PI/2;
  for(let i=0;i<3;i++){
    const r=.12+i*.075,x=-.65+i*.19;
    const rib=torus(g,r,.045,P.cream,x,.32,0);rib.rotation.y=Math.PI/2;
  }
  const spiral=[];for(let i=0;i<=42;i++){const t=i/42,a=t*Math.PI*7,r=.06+t*.25;spiral.push([-.84+t*.94,.32+Math.cos(a)*r,Math.sin(a)*r]);}
  line(g,spiral,.016,P.woodDark);
  const mouth=torus(g,.26,.08,P.cream,.72,.34,.02);mouth.rotation.y=Math.PI/2;mouth.scale.y=1.15;
  const aperture=cylinder(g,.225,.225,.022,P.woodDark,.725,.34,.02,16);aperture.rotation.z=Math.PI/2;
  for(let i=0;i<4;i++)cone(g,.09,.2,P.cream,.1+i*.13,.61-i*.025,-.07).rotation.z=-.4;
  return g;
}
function cowrie(){
  const g=group();sphere(g,.48,.32,.7,P.cream,0,.32,0);
  line(g,[[0,.56,-.49],[.025,.65,-.22],[-.01,.66,.15],[0,.57,.5]],.044,P.woodDark);
  for(let i=0;i<8;i++){
    const z=-.43+i*.12,y=.65-.3*z*z;
    for(const s of [-1,1])line(g,[[s*.035,y+.009,z],[s*.15,y-.012,z+.025]],.014,P.woodDark);
  }
  for(const s of [-1,1])line(g,[[s*.37,.26,-.3],[s*.44,.32,0],[s*.37,.26,.3]],.01,0xf6e3a7);
  return g;
}
function starfish(pink=false){
  const g=group(),pts=[];
  for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.29:.8;pts.push([Math.cos(a)*r,Math.sin(a)*r]);}
  groundShape(g,pts,.15,pink?P.pink:P.orange);
  sphere(g,.28,.08,.28,pink?P.pink:P.orange,0,.18,0);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*.4-Math.PI/2;
    for(let j=1;j<4;j++){const r=.16+j*.13;sphere(g,.024,.012,.024,P.cream,Math.cos(a)*r,.19,Math.sin(a)*r);}
  }
  return g;
}
function castle(turrets=false){
  const g=group();
  groundShape(g,[[-.98,-.7],[.98,-.7],[1.08,.63],[.64,.76],[-.79,.72],[-1.09,.36]],.1,P.cream);
  box(g,1.48,.64,1.05,P.cream,0,.43,0);
  box(g,1.56,.12,1.12,0xf6e3a7,0,.78,0);
  for(const z of [-.5,.5])for(let i=0;i<5;i++)box(g,.19,.23,.2,P.cream,-.64+i*.32,.91,z);
  for(const x of [-.68,.68])for(const z of [-.19,.19])box(g,.2,.23,.19,P.cream,x,.91,z);
  extrude(g,[[-.22,0],[.22,0],[.22,.28],[.15,.43],[0,.48],[-.15,.43],[-.22,.28]],.025,P.wood,0,.11,.54,.02);
  for(const z of [-.53,.53])for(const y of [.36,.61])for(const x of [-.5,.1,.55])box(g,.22,.012,.018,0xefd58e,x,y,z);
  if(turrets)for(const x of [-.85,.85]){
    cylinder(g,.25,.31,1.06,P.cream,x,.63,0,12);
    cone(g,.36,.52,P.cream,x,1.42,0,12);
    cylinder(g,.018,.018,.4,P.wood,x,1.85,0,6);
    const flag=extrude(g,[[0,0],[.34,-.1],[0,-.22]],.02,P.red,x,2.03,0,.005);flag.name='castle-flag';
    box(g,.1,.21,.02,P.wood,x,.9,.25);
  }
  return g;
}
function towel(sun=false){
  const g=group();g.userData.motion='cloth';
  box(g,1.27,.035,1.95,sun?P.pink:P.blue,0,.02,0);
  if(sun){
    cylinder(g,.32,.32,.018,P.yellow,0,.05,0,20);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      line(g,[[Math.sin(a)*.39,.06,Math.cos(a)*.39],[Math.sin(a)*.5,.06,Math.cos(a)*.5]],.02,P.yellow);
    }
  }else for(let i=0;i<4;i++)box(g,1.27,.008,.17,P.cream,0,.044,-.7+i*.46);
  for(const z of [-1.02,1.02])for(let i=0;i<7;i++)line(g,[[-.54+i*.18,.03,z-Math.sign(z)*.05],[-.53+i*.18,.02,z+Math.sign(z)*.05]],.012,P.cream);
  return g;
}
function ball(){
  const g=group();
  // Six true spherical beach-ball panels, not flat decals.
  const colors=[P.yellow,P.blue,P.white,P.red,P.yellow,P.white];
  for(let i=0;i<6;i++){
    const geo=new THREE.SphereGeometry(.58,6,12,i*Math.PI/3,Math.PI/3,0,Math.PI);
    const m=new THREE.Mesh(geo,mat(colors[i]));m.position.y=.58;m.castShadow=m.receiveShadow=true;g.add(m);
  }
  cylinder(g,.09,.09,.015,P.white,0,1.165,0,12);
  cylinder(g,.028,.028,.02,P.metal,0,1.18,0,8);
  g.rotation.z=.17;g.position.y=.015;
  return g;
}
function bucket(){
  const g=group();
  cylinder(g,.43,.29,.64,P.blue,0,.33,0,14);
  const rim=torus(g,.425,.045,P.blue,0,.67,0);rim.rotation.x=Math.PI/2;
  cylinder(g,.386,.386,.012,P.cream,0,.642,0,14);
  sphere(g,.29,.055,.29,P.cream,0,.65,0);
  line(g,[[-.43,.58,0],[-.45,.98,0],[0,1.19,0],[.45,.98,0],[.43,.58,0]],.028,P.metal);
  for(const x of [-.42,.42])sphere(g,.045,.045,.045,P.metal,x,.58,0);
  return g;
}
function spade(){
  const g=group();
  extrude(g,[[-.3,.03],[.3,.03],[.34,.37],[.24,.52],[-.24,.52],[-.34,.37]],.075,P.orange,0,0,-.04,.04);
  line(g,[[0,.2,.05],[0,.5,.05]],.025,0xd9573a);
  cylinder(g,.038,.038,.87,P.wood,0,.9,0,8);
  const grip=torus(g,.17,.04,0xd9573a,0,1.45,0);grip.scale.y=.85;
  box(g,.3,.065,.07,0xd9573a,0,1.3,0);
  return g;
}

export const beachFactories={
  'sand-edge-bank':()=>sandEdge('bank'),'sand-edge-cove':()=>sandEdge('cove'),'sand-edge-island':()=>sandEdge('island'),
  'shell-scallop':scallop,'shell-conch':conch,'shell-cowrie':cowrie,
  'starfish-orange':()=>starfish(),'starfish-pink':()=>starfish(true),
  'sandcastle-small':()=>castle(),'sandcastle-turrets':()=>castle(true),
  'towel-striped':()=>towel(),'towel-sun':()=>towel(true),'beach-ball':ball,bucket,spade,
};
