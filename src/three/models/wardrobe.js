import { THREE, P, group, mesh, box, sphere, cylinder, cone, torus, line, extrude } from './primitives.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Picker indexes intentionally preserve the original Rive wardrobe URL format.
// Acc 6 was omitted by that UI; it is appended here instead of shifting saved outfits.
const SOURCES = {
  cap: ['CAP 1-DNIKtNKT','CAP 2-BSJGXQzg','CAP 3-C1fk9KHJ','CAP 4-7qulB_LH','CAP 5-dXKbYJXv','CAP 6-Dqjgvjqr','CAP 7-D8qf1IRa','CAP 8-Bea8yobv','CAP 9-DqXsAbWE','CAP 10-BDQKCoTm','CAP 11-Cl02vBcE','CAP 12-DS4PTPq7','CAP 13-BSM07WKk'],
  shades: ['Shades 2-BV_7yFlj','Shades 8-DZUoK_Yx','Shades 12-CXtvPSHt'],
  acc: ['Acc 4-DZTm7x-U','Acc 5-U2R1Nk2A','Acc 8-B-TC1T5x','Acc 9-C6lDQyid','Acc 10-C4Nqr69D','Acc 11-Bx4gkJ2m','Acc 12-DmQnOVug','Acc 6-ApWubo30'],
  shoes: ['Shoes 1-CgUhwjGu','Shoes 2-b9vbYMYR','Shoes 5-5bIFK-Jn','Shoes 6-DYC9gQ7q','Shoes 7-Bikof7Po','Shoes 8-BqY5bUcn','Shoes 9-DO5ZuNlm','Shoes 10-Cwf-yX91','Shoes 11-WvpMUfEj','Shoes 12-DflFAMA2'],
};
const PREVIEW_ALIASES={
  cap:['Cap prev 1-J3zl9c-K','Cap prev 2-BD5sOyJR','Cap prev 3-BaLvgcDb','Cap prev 4-H_y1x2KC','Cap prev 5-Db4J9lu8','Cap prev 6-CE6F1-OA','Cap prev 7-BHLVusGr','Cap prev 8-B7xatrhK','Cap prev 9-C-ahB0B8','Cap prev 10-BiB6z13F','Cap prev 11-BoBVXR_0','Cap prev 12-CMu1O6N_','Cap prev 13-ymXOc4mW'],
  shades:['Shades prev 2-DrRvDBKv','Shades prev 8-CLSuAlkC','Shades prev 12-dQOu5t7P'],
  acc:['Acc prev 4-El-gDIaf','Acc prev 5-CUanarPF','Acc prev 8-P0Zd0jkr','Acc prev 9-VMtuHL-f','Acc prev 10-dzH4-2L5','Acc prev 11-Cr7f2lAh','Acc prev 12-D0syDDC9','Acc prev 6-Bca7t9kl'],
};
const NAMES = {
  cap: ['Captain’s cap','Aviator helmet','Green bandana','Black fedora','Purple headscarf','Ribbed beanie','Santa hat','Blue baseball cap','Pink fish hat','Purple cat cap','Spartan helmet','Silver headphones','Horned gaming headset'],
  shades: ['Round sunglasses','Heart sunglasses','Feather masquerade'],
  acc: ['Studded collar','Red electric guitar','Pink skateboard','Green scarf','Crossbody bag','Skull neckerchief','Sheathed sword','Orange laboratory flask'],
  shoes: ['Red sneakers','Blue loafers','Yellow sneakers','Blue sneakers','Pink sneakers','Yellow loafers','Red loafers','Pink loafers','Green sneakers','Green loafers'],
};
const BLACK=0x262626, SILVER=0xc7c8c5, GOLD=0xf3bf42, BLUE=0x449dd7, VIOLET=0x9770d8;

function named(name){const g=group();g.name=name;return g;}
function ring(g,r,t,color,x=0,y=0,z=0){const m=torus(g,r,t,color,x,y,z);m.rotation.x=Math.PI/2;return m;}
function band(g,color,y=0,r=.365,h=.1){return cylinder(g,r,r,h,color,0,y,0,24);}
function dome(g,color,rx=.37,ry=.2,rz=.33,y=.04){return sphere(g,rx,ry,rz,color,0,y,0);}
function brim(g,color,width=.38,depth=.22,y=-.08,z=.22){return sphere(g,width,.032,depth,color,0,y,z);}
function star(g,x,y,z,r=.055,color=GOLD){const pts=Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,s=i%2?r*.43:r;return[Math.cos(a)*s,Math.sin(a)*s]});return extrude(g,pts,.018,color,x,y,z,.002);}
function heart(g,color,x=0,y=0,z=0,size=.1){const s=new THREE.Shape();s.moveTo(0,-.68);s.bezierCurveTo(-1,-.03,-.9,.65,-.42,.65);s.bezierCurveTo(-.16,.65,0,.43,0,.3);s.bezierCurveTo(.06,.48,.22,.65,.46,.65);s.bezierCurveTo(.96,.65,1,-.03,0,-.68);const geom=new THREE.ExtrudeGeometry(s,{depth:.2,bevelEnabled:true,bevelSegments:1,bevelSize:.08,bevelThickness:.05,steps:1,curveSegments:6});const m=mesh(g,geom,color,x,y,z);m.scale.setScalar(size);return m;}
function earCup(g,side,color,y=-.05){sphere(g,.075,.16,.14,BLACK,side*.37,y,0);sphere(g,.08,.125,.11,color,side*.405,y,.018);}
function headband(g,color,r=.38){return line(g,[[-r,-.04,0],[-r*.9,.19,0],[0,.36,0],[r*.9,.19,0],[r,-.04,0]],.035,color);}

function cap(n){
  const g=named(`Cap ${n}`);
  switch(n){
    case 1: // A broad white-topped captain cap, blue band, black visor and gold badge.
      dome(g,BLUE,.42,.17,.35,.045);dome(g,P.white,.36,.10,.29,.13);band(g,BLUE,-.025,.36,.1);brim(g,BLACK,.36,.23,-.08,.23);sphere(g,.074,.074,.018,GOLD,-.19,.075,.32);star(g,-.19,.075,.342,.047,0x996b22);break;
    case 2:
      dome(g,0xac6a36,.37,.21,.33,.035);
      for(const side of [-1,1]){sphere(g,.095,.24,.19,0xac6a36,side*.31,-.17,0);sphere(g,.063,.19,.13,P.cream,side*.336,-.15,.07);const lens=torus(g,.099,.024,0xa96730,side*.16,.115,.29);lens.rotation.y=side*.18;sphere(g,.074,.07,.022,0x45575d,side*.16,.115,.31);box(g,.017,.10,.008,P.white,side*.16,.115,.335).rotation.z=-.2;}line(g,[[-.38,.08,.16],[0,.13,.31],[.38,.08,.16]],.025,BLACK);break;
    case 3:
      g.position.y=-.14;band(g,0x56bb3c,-.05,.37,.13);for(const side of [-1,1]){const knot=sphere(g,.14,.045,.07,0x56bb3c,-.37,-.065,-.08);knot.rotation.z=side*.6;}break;
    case 4:
      brim(g,BLACK,.47,.42,-.07,0);cylinder(g,.26,.34,.26,0x404040,0,.06,0,10);band(g,0x252525,-.04,.342,.06);sphere(g,.24,.035,.22,0x353535,0,.19,0);break;
    case 5:
      cone(g,.395,.37,VIOLET,0,.095,0,16).scale.z=.83;band(g,VIOLET,-.07,.36,.08);for(let i=0;i<5;i++)sphere(g,.025,.045,.014,0x7753bc,(i-2)*.11,.02+(i%2)*.07,.315-Math.abs(i-2)*.02);sphere(g,.11,.035,.06,VIOLET,-.37,-.1,.01).rotation.z=.5;break;
    case 6:
      dome(g,0xbbbbb3,.35,.30,.32,.045);band(g,0xa2a49d,-.065,.365,.13);for(let i=0;i<12;i++){const a=i*Math.PI/6;line(g,[[Math.cos(a)*.36,-.12,Math.sin(a)*.32],[Math.cos(a)*.36,-.005,Math.sin(a)*.32]],.007,0x787b73);}for(let i=0;i<7;i++){const a=i*Math.PI/3.5;line(g,[[Math.cos(a)*.352,.06,Math.sin(a)*.322],[Math.cos(a)*.296,.21,Math.sin(a)*.270],[0,.35,0]],.005,0x92958c);}break;
    case 7:
      cone(g,.35,.43,0xc51e4b,0,.13,0,18);sphere(g,.13,.10,.13,0xc51e4b,-.16,.28,0);sphere(g,.075,.075,.075,0xffe8ec,-.26,.26,0);ring(g,.34,.065,0xffe8ec,0,-.085,0);break;
    case 8:
      dome(g,BLUE,.37,.22,.33,.035);band(g,BLUE,-.055,.36,.08);const visor=brim(g,BLUE,.33,.24,-.085,.29);visor.rotation.y=-.12;box(g,.10,.045,.018,GOLD,0,-.025,.329);line(g,[[0,.25,0],[0,.17,.23],[0,.02,.33]],.006,0x2d7fbd);sphere(g,.03,.02,.03,BLUE,0,.255,0);break;
    case 9:
      dome(g,0xf79cc0,.40,.26,.34,.045);ring(g,.32,.065,0xf79cc0,0,-.06,0);for(const side of [-1,1]){sphere(g,.10,.105,.025,P.white,side*.28,.12,.27);sphere(g,.04,.045,.018,BLACK,side*.28,.12,.295);}sphere(g,.075,.07,.05,0xeb538f,0,-.025,.37);for(let i=0;i<5;i++)sphere(g,.045,.085,.07,0xe9639a,(i-2)*.07,.26,.02);const tail=extrude(g,[[0,0],[.20,.15],[.20,-.15]],.06,0xe9639a,.34,.02,-.02);tail.rotation.y=-.35;break;
    case 10:
      dome(g,VIOLET,.37,.15,.32,-.015);brim(g,0x8d5fce,.39,.28,-.085,.16);for(const side of [-1,1]){extrude(g,[[-.07,0],[0,.20],[.09,0]],.10,0x8153b5,side*.27,.09,-.02);extrude(g,[[-.038,.025],[0,.14],[.045,.025]],.012,0xc899ed,side*.27,.10,.091);}break;
    case 11:
      dome(g,0xe8b45f,.36,.28,.33,.055);for(const side of [-1,1]){const guard=box(g,.095,.26,.23,0xe8b45f,side*.31,-.15,.08);guard.rotation.z=-side*.12;}box(g,.075,.20,.11,0xe8b45f,0,-.13,.33);box(g,.10,.28,.42,0xad5d55,0,.29,0);box(g,.06,.31,.37,0xd68a7f,0,.31,0);break;
    case 12:
      headband(g,SILVER);headband(g,BLACK,.345);for(const side of [-1,1]){earCup(g,side,SILVER,-.10);box(g,.024,.19,.16,P.white,side*.455,-.10,.02);}break;
    case 13:
      headband(g,0x474ecb);for(const side of [-1,1]){earCup(g,side,0x5f63df,-.11);line(g,[[side*.41,-.05,.06],[side*.48,.05,.04],[side*.51,.17,0],[side*.48,.25,-.04]],.034,0xb7b8d2);}line(g,[[.39,-.16,.08],[.26,-.28,.25],[.10,-.28,.32]],.017,BLACK);sphere(g,.038,.025,.026,BLACK,.10,-.28,.32);break;
  }
  return g;
}

function shades(n){
  const g=named(`Shades ${n}`);
  for(const side of [-1,1]){
    if(n===2){sphere(g,.105,.10,.035,BLACK,side*.14,0,0);const glint=box(g,.018,.12,.008,0x68706f,side*.14,0,.035);glint.rotation.z=.35;}
    if(n===8){heart(g,0xf04c54,side*.14,0,-.005,.115);heart(g,BLACK,side*.14,.002,.021,.090);}
    if(n===12){sphere(g,.145,.09,.035,BLACK,side*.15,0,0);for(let i=0;i<6;i++){const a=i*Math.PI/5;const feather=sphere(g,.025,.095,.018,i%2?BLACK:P.white,side*.15+Math.cos(a)*.12,.045+Math.sin(a)*.10,-.01);feather.rotation.z=-a+Math.PI/2;}}
    line(g,[[side*.23,0,0],[side*.32,.005,-.06],[side*.36,.005,-.20]],.013,BLACK);
  }
  line(g,[[-.05,.01,0],[0,.028,.01],[.05,.01,0]],.012,BLACK);
  return g;
}
function strap(g,color,tilt=0){const r=ring(g,.46,.025,color,0,-.06,0);r.scale.y=.99;r.rotation.z=tilt;return r;}
function accessory(n){
  const g=named(`Accessory ${n}`);
  if(n===4){const c=band(g,BLACK,-.02,.455,.10);c.scale.z=.98;for(let i=0;i<8;i++){const a=(i/7-.5)*2.4;sphere(g,.018,.018,.018,SILVER,Math.sin(a)*.460,-.02,Math.cos(a)*.450);}}
  if(n===5){strap(g,BLACK);const guitar=named('Guitar');guitar.position.set(.24,-.41,.57);guitar.rotation.z=-.27;g.add(guitar);sphere(guitar,.17,.20,.065,0xe95446,0,-.13,0);sphere(guitar,.12,.12,.06,0xe95446,-.10,.035,0);sphere(guitar,.12,.12,.06,0xe95446,.10,.035,0);box(guitar,.072,.55,.045,0xb9b4a5,0,.28,.015);box(guitar,.105,.20,.055,0xe3cd61,0,.65,.013);for(let i=0;i<4;i++)box(guitar,.16,.015,.02,SILVER,0,.59+i*.04,.01);box(guitar,.09,.04,.022,BLACK,0,-.08,.072);for(let i=0;i<4;i++)line(guitar,[[(i-1.5)*.012,-.14,.08],[(i-1.5)*.012,.73,.052]],.002,SILVER);}
  if(n===6){const flask=named('Flask');flask.position.set(.27,-.40,.57);flask.rotation.z=-.10;g.add(flask);sphere(flask,.17,.17,.12,0xff874c,0,-.15,0);sphere(flask,.152,.075,.105,0xffdc3b,0,-.22,.025);cylinder(flask,.065,.072,.28,0xff874c,0,.04,0);ring(flask,.072,.013,P.cream,0,.18,0);for(const s of [-1,1]){sphere(flask,.035,.04,.03,P.white,s*.19,.04,.01);sphere(flask,.05,.06,.03,P.white,s*.22,.13,.01);}}
  if(n===8){strap(g,BLACK);const board=named('Skateboard');g.add(board);board.position.set(.28,-.35,.57);board.rotation.z=.30;sphere(board,.14,.43,.035,0xe43fbc,0,0,0);box(board,.24,.53,.045,0xe43fbc);for(const y of [-.25,.25]){box(board,.29,.025,.045,SILVER,0,y,.07);for(const x of [-.15,.15]){const wheel=cylinder(board,.045,.045,.07,BLACK,x,y,.075);wheel.rotation.z=Math.PI/2;}}for(const x of [-.04,.04])box(board,.025,.09,.012,BLACK,x,0,.035);}
  if(n===9){const scarf=band(g,0x20cd58,-.02,.470,.15);scarf.scale.z=.98;ring(g,.463,.022,0x139e43,0,.065,0).scale.y=.98;box(g,.13,.31,.04,0x20cd58,-.28,-.20,.47).rotation.z=-.13;for(let i=0;i<4;i++)line(g,[[-.34+i*.036,-.32,.50],[-.35+i*.036,-.40,.50]],.008,0x139e43);}
  if(n===10){line(g,[[-.35,.08,.18],[0,-.24,.47],[.36,-.37,.29],[.43,-.12,-.11],[.13,.06,-.34]],.035,BLACK);const bag=box(g,.32,.21,.13,0x555957,.22,-.31,.55);bag.rotation.z=-.30;box(g,.28,.06,.025,0x737975,.21,-.25,.63).rotation.z=-.30;}
  if(n===11){strap(g,0x454545);for(const side of [-1,1]){const wing=box(g,.27,.10,.05,0x4c4d4c,side*.17,-.04,.49);wing.rotation.z=side*.25;}extrude(g,[[-.08,0],[.06,0],[.09,-.24],[0,-.31],[-.05,-.21]],.04,0x454545,0,-.10,.55);sphere(g,.077,.08,.03,SILVER,0,-.055,.54);for(const side of [-1,1])sphere(g,.019,.028,.015,BLACK,side*.028,-.05,.568);box(g,.06,.035,.025,SILVER,0,-.12,.55);}
  if(n===12){strap(g,BLACK);const sword=named('Sheathed sword');g.add(sword);sword.position.set(.24,-.25,-.38);sword.rotation.z=-.22;box(sword,.09,1.0,.07,0x494c4b,0,-.05,0);box(sword,.27,.04,.10,SILVER,0,.44,0);box(sword,.07,.28,.06,BLACK,0,.59,0);box(sword,.11,.04,.08,SILVER,0,.74,0);for(let i=0;i<4;i++)box(sword,.075,.012,.067,SILVER,0,.49+i*.06,0);}
  return g;
}
function footwear(n){
  const g=named(`Shoes ${n}`),pairs=[];
  const colors={1:0xe95448,2:0x527fbc,5:0xeeb843,6:0x537fbe,7:0xd66cbb,8:0xeeb843,9:0xe95448,10:0xd66cbb,11:0x48ba49,12:0x48ba49};
  const sneaker=[1,5,6,7,11].includes(n),color=colors[n];
  for(const side of [-1,1]){const shoe=named(side<0?'ShoeL':'ShoeR');shoe.position.x=side*.22;g.add(shoe);pairs.push(shoe);sphere(shoe,.205,.045,.27,sneaker?P.white:BLACK,0,-.035,.06);sphere(shoe,.19,.075,.25,color,0,.018,.06);if(sneaker){sphere(shoe,.15,.055,.12,P.white,0,.025,.24);sphere(shoe,.13,.12,.11,color,0,.09,-.01);for(let i=0;i<3;i++)box(shoe,.15,.012,.015,P.white,0,.102-i*.012,.05+i*.035);line(shoe,[[-.17,-.035,.17],[0,-.043,.31],[.17,-.035,.17]],.009,SILVER);}else{line(shoe,[[-.11,.075,.07],[0,.057,.10],[.10,.075,.07]],.009,BLACK);}}
  g.userData.footwear=pairs;
  return g;
}


// Clothing is rigid at its anchor. Merge its decorations by material once so a
// crowded plaza does not pay a draw call for every lace, rivet or hat seam.
function mergeRigid(root){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),parts=new Map(),owned=new Set();
  root.traverse(node=>{if(!node.isMesh)return;const geometry=(node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone()).applyMatrix4(inverse.clone().multiply(node.matrixWorld));if(!parts.has(node.material))parts.set(node.material,[]);parts.get(node.material).push(geometry);if(['TubeGeometry','ExtrudeGeometry'].includes(node.geometry.type))owned.add(node.geometry);});
  root.clear();for(const [material,geometries]of parts){const geometry=mergeGeometries(geometries);if(!geometry)throw new Error('Wardrobe geometry could not be merged');geometry.userData.wardrobeOwned=true;const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;root.add(m);geometries.forEach(g=>g.dispose());}owned.forEach(g=>g.dispose());
}

export const wardrobeEntries=Object.entries(SOURCES).flatMap(([slot,sources])=>sources.map((source,i)=>{
  const sourceNumber=Number(source.match(/\d+/)[0]),index=i+1;
  return {id:`${slot}-${sourceNumber}`,name:NAMES[slot][i],category:'wardrobe',slot,index,sourceNumber,source:`drip-ref/svg/${source}.svg`,aliases:PREVIEW_ALIASES[slot]?.[i]?[`drip-ref/svg/${PREVIEW_ALIASES[slot][i]}.svg`]:[],create:()=>createWardrobe(slot,index)};
}));

/** Return a genuine 3D garment in its attachment-anchor coordinates. */
export function createWardrobe(slot,index){
  if(slot==='accessory')slot='acc';
  const entry=typeof index==='string'&&!/^\d+$/.test(index)
    ?wardrobeEntries.find(e=>e.slot===slot&&(e.id===index||e.source===index||e.aliases.includes(index)||e.source.split('/').at(-1).startsWith(`${index}-`)))
    :wardrobeEntries.find(e=>e.slot===slot&&e.index===Number(index));
  if(!entry)return named('No wardrobe');
  const result=({cap,shades,acc:accessory,shoes:footwear}[slot])(entry.sourceNumber);
  if(slot==='shoes')result.userData.footwear.forEach(mergeRigid);else mergeRigid(result);
  Object.assign(result.userData,{wardrobeId:entry.id,slot,index:entry.index,source:entry.source});
  return result;
}
