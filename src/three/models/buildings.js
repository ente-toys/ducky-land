import { P, group, box, sphere, cylinder, cone, torus, line, extrude, leaf, label } from './primitives.js';
import { foodFactories } from './food.js';

const amber=0xffae2c;
function put(g,part,x,y,z,s=1){part.position.set(x,y,z);part.scale.setScalar(s);g.add(part);return part;}
function windowPane(g,x,y,z,w=.44,h=.54,rotation=0){
  const p=group();p.rotation.y=rotation;g.add(p);p.position.set(x,y,z);
  box(p,w+.09,h+.09,.07,P.cream);
  box(p,w,h,.085,P.water,0,0,.01);
  box(p,.035,h,.035,P.cream,0,0,.065);
  box(p,w,.035,.035,P.cream,0,0,.065);
  box(p,w+.16,.065,.15,P.wood,0,-h/2-.04,.025);
  return p;
}
function door(g,x,y,z,h=.95,w=.47){
  const pts=[[-w/2,0],[w/2,0],[w/2,h*.72],[w*.22,h*.97],[0,h],[-w*.22,h*.97],[-w/2,h*.72]];
  extrude(g,pts,.06,P.wood,x,y,z,.025);
  for(const dx of [-w*.26,w*.05])box(g,.014,h*.72,.01,P.woodDark,x+dx,y+h*.4,z+.095);
  sphere(g,.035,.035,.035,amber,x+w*.26,y+h*.42,z+.11);
  box(g,w+.2,.08,.35,P.stone,x,y+.025,z+.1);
}
function pitchedRoof(g,w,d,y,color){
  extrude(g,[[-w/2,0],[0,.71],[w/2,0]],d,color,0,y,-d/2,.035);
  for(const sign of [-1,1]){
    for(let i=0;i<3;i++){
      const x=sign*(.24+i*.22)*w*.5, yy=y+.71*(1-Math.abs(x)/(w*.5));
      for(const z of [-d*.25,d*.12])line(g,[[x-.065,yy+.017,z-.12],[x,yy+.023,z],[x+.065,yy+.017,z+.12]],.012,P.cream);
    }
  }
  box(g,w+.04,.065,.08,P.woodDark,0,y-.015,d/2+.015);
  box(g,w+.04,.065,.08,P.woodDark,0,y-.015,-d/2-.015);
}
function awning(g,w,depth,y,z,color){
  const a=group();a.name='awning';a.userData.motion='cloth';g.add(a);
  for(let i=0;i<8;i++){
    const x=-w/2+w/16+i*w/8,c=i%2?P.white:color;
    const p=box(a,w/8+.008,.05,depth,c,x,y,z);p.rotation.x=.22;
    sphere(a,w/16,.11,.045,c,x,y-.16,z+depth*.49);
  }
  return a;
}
function house(kind){
  const g=group(),tall=kind==='townhouse',pond=kind==='pond-house',shop=['bakery','library','cafe'].includes(kind);
  const w=kind==='library'?2.8:tall?1.65:2.2,d=1.55,h=tall?2.65:1.65,b=pond?.52:0;
  const wall=kind==='library'?P.purple:tall?P.pink:pond?P.blue:P.cream;
  if(pond){
    for(const x of [-w*.4,w*.4])for(const z of [-d*.38,d*.38])box(g,.14,.65,.14,P.wood,x,.325,z);
    for(let i=0;i<8;i++)box(g,w+.28,.12,.15,P.wood,0,.53,-d*.5+i*.26);
    for(let i=0;i<3;i++)box(g,.7,.14,.26,P.wood,0,.1+i*.15,1.22-i*.2);
  }
  box(g,w,h,d,wall,0,b+h/2,0);
  box(g,w+.08,.14,d+.08,P.stone,0,b+.07,0);
  if(tall){
    box(g,w+.18,.2,d+.18,P.purple,0,b+h+.04,0);
    box(g,w+.12,.15,d+.12,P.purple,0,b+h+.24,0);
    for(const x of [-.45,.45])windowPane(g,x,b+2.02,d/2+.02,.37,.52);
    box(g,w,.07,.05,P.cream,0,b+1.6,d/2+.02);
  }else pitchedRoof(g,w+.3,d+.24,b+h,kind==='library'||pond?P.blue:P.red);
  box(g,.22,.72,.28,P.stone,-w*.31,b+h+.35,-.35);
  box(g,.3,.09,.34,P.stone,-w*.31,b+h+.73,-.35);
  box(g,.18,.012,.22,P.ink,-w*.31,b+h+.78,-.35);
  door(g,0,b,d/2+.025);
  windowPane(g,-w*.32,b+.8,d/2+.04,w*.21,.56);
  windowPane(g,w*.32,b+.8,d/2+.04,w*.21,.56);
  // All buildings have actual side/rear walls, window frames and back doors.
  for(const x of [-1,1])windowPane(g,x*(w/2+.025),b+h*.53,0,.44,.56,x*Math.PI/2);
  windowPane(g,0,b+h*.55,-d/2-.035,.5,.55,Math.PI);
  if(shop){
    box(g,w*.75,.26,.09,P.wood,0,b+1.42,d/2+.07);
    label(g,kind==='bakery'?'BREAD':kind==='library'?'LIBRARY':'QUACK CAFE',w*.7,.21,0,b+1.42,d/2+.125,'#af6734','#fff4c5');
    if(kind==='library'){
      for(const side of [-1,1])for(let i=0;i<4;i++){
        const bh=.24+i*.025,x=side*w*.32+(i-1.5)*.105;
        box(g,.08,bh,.15,[P.red,amber,P.blue,P.grass][i],x,b+.59+bh/2,d/2+.11);
        box(g,.06,.014,.012,P.cream,x,b+.64,d/2+.195);
      }
      const book=group();box(book,.38,.065,.42,P.cream,-.19,0,0).rotation.z=-.13;box(book,.38,.065,.42,P.cream,.19,0,0).rotation.z=.13;
      put(g,book,0,b+h+.77,.02,.8);
    }else{
      awning(g,w+.05,.65,b+1.17,d/2+.33,kind==='cafe'?P.leaf:P.red);
      if(kind==='bakery')put(g,foodFactories.croissant(),0,b+h+.74,.02,.52);
      else{
        cylinder(g,.23,.18,.3,P.cream,0,b+h+.89,.08);
        cylinder(g,.2,.2,.01,P.woodDark,0,b+h+1.045,.08);
        torus(g,.12,.035,P.cream,.25,b+h+.92,.08);
      }
    }
  }
  return g;
}
function kiosk(){
  const g=group();
  box(g,1.65,1.4,1.35,P.grass,0,.7,0);
  pitchedRoof(g,1.9,1.6,1.4,P.red);
  box(g,1.25,.6,.08,P.woodDark,0,.94,.71);
  box(g,1.13,.5,.025,P.water,0,.97,.76);
  box(g,1.65,.11,.55,P.wood,0,.63,.77);
  for(const x of [-.62,0,.62])box(g,.06,.63,.07,P.cream,x,.96,.82);
  box(g,1.2,.26,.1,P.yellow,0,1.48,.89);label(g,'HELLO',1.07,.21,0,1.48,.95,'#f4d93b');
  windowPane(g,.85,.83,0,.55,.65,Math.PI/2);
  windowPane(g,-.85,.83,0,.55,.65,-Math.PI/2);
  const back=group();back.rotation.y=Math.PI;g.add(back);door(back,0,0,.69,1.13,.48);
  return g;
}
function flowerPot(g,x,y,z,color=P.pink,s=1){
  const p=group();put(g,p,x,y,z,s);
  cylinder(p,.14,.1,.25,P.orange,0,.125,0);
  cylinder(p,.16,.16,.05,P.orange,0,.25,0);
  cylinder(p,.13,.13,.012,P.woodDark,0,.28,0);
  line(p,[[0,.27,0],[.02,.5,0],[0,.71,0]],.015,P.leafDark);
  leaf(p,P.leaf,.09,.44,.01,.11).rotation.z=.3;
  for(let k=0;k<5;k++){const a=k*Math.PI*.4;sphere(p,.095,.095,.048,color,Math.cos(a)*.095,.7+Math.sin(a)*.095,.01);}
  sphere(p,.052,.052,.054,P.yellow,0,.7,.05);
  return p;
}
function stall(type){
  const g=group(),colors={bread:amber,fruit:P.red,flower:P.pink,'ice-cream':P.blue};
  for(const x of [-.98,.98])for(const z of [-.42,.42])box(g,.085,1.9,.085,P.wood,x,.95,z);
  box(g,2.1,.71,.85,P.wood,0,.38,0);
  box(g,2.24,.12,1.03,P.wood,0,.79,0);
  for(let i=-4;i<=4;i++)box(g,.016,.58,.012,P.woodDark,i*.22,.37,.431);
  for(const side of [-1,1])for(let i=0;i<3;i++)box(g,.012,.016,.8,P.woodDark,side*1.055,.18+i*.19,0);
  box(g,1.74,.05,.65,P.woodDark,0,.86,0);
  awning(g,2.32,1.3,1.93,0,colors[type]);
  // Counter merchandise is independently modeled, not printed onto the stall.
  if(type==='bread'){
    put(g,foodFactories.loaf(),-.65,.88,.02,.3);
    put(g,foodFactories.baguette(),.11,.89,-.16,.28).rotation.y=.15;
    put(g,foodFactories.croissant(),.68,.88,.14,.36);
  }else if(type==='fruit'){
    for(let i=0;i<3;i++){
      box(g,.54,.12,.62,P.wood, -.65+i*.65,.9,0);
      for(let j=0;j<3;j++)put(g,foodFactories[['apple','pear','cherries'][i]](),-.8+i*.65+(j%2)*.24,.96,j===2?-.17:.14,.22);
    }
  }else if(type==='flower'){
    for(let i=0;i<3;i++)flowerPot(g,-.65+i*.65,.86,0,[P.pink,P.white,amber][i],.75);
    g.userData.motion='vegetation';
  }else{
    box(g,1.68,.14,.42,P.cream,0,.9,0);
    for(let i=0;i<3;i++)put(g,foodFactories['ice-cream-double'](),-.58+i*.58,.97,0,.35);
  }
  box(g,1.2,.28,.05,P.cream,0,.41,.46);
  label(g,{bread:'BREAD',fruit:'FRUIT',flower:'BLOOMS','ice-cream':'SCOOPS'}[type],1.1,.22,0,.41,.49);
  return g;
}
function gazebo(){
  const g=group();
  cylinder(g,1.32,1.39,.16,P.stone,0,.08,0,8);
  cylinder(g,1.24,1.31,.13,P.stone,0,.225,0,8);
  for(let i=0;i<8;i++){
    const a=Math.PI/8+i*Math.PI/4,x=Math.cos(a)*1.12,z=Math.sin(a)*1.12;
    cylinder(g,.055,.075,1.75,P.wood,x,1.12,z,8);
    cylinder(g,.11,.11,.07,P.woodDark,x,.34,z,8);
    if(i!==1){
      const b=a+Math.PI/4,xb=Math.cos(b)*1.12,zb=Math.sin(b)*1.12;
      line(g,[[x,.81,z],[xb,.81,zb]],.035,P.wood);
      for(let j=1;j<4;j++)line(g,[[x+(xb-x)*j/4,.34,z+(zb-z)*j/4],[x+(xb-x)*j/4,.8,z+(zb-z)*j/4]],.023,P.wood);
    }
  }
  cone(g,1.52,.78,P.blue,0,2.32,0,8);
  cylinder(g,1.53,1.53,.06,P.blue,0,1.94,0,8);
  sphere(g,.09,.16,.09,amber,0,2.79,0);
  box(g,.8,.12,.45,P.stone,0,.06,1.25);
  return g;
}
function lighthouse(){
  const g=group();
  cylinder(g,.92,1.05,.2,P.orange,0,.1,0,16);
  sphere(g,.88,.96,.76,P.yellow,0,1.09,0);
  sphere(g,.55,.8,.53,P.yellow,0,2.12,-.06);
  sphere(g,.61,.6,.57,P.yellow,0,2.63,.04);
  // The lighthouse is a giant rubber duck, with side wings and a broad bill.
  sphere(g,.48,.12,.48,P.orange,0,2.47,.6);
  for(const sign of [-1,1]){
    sphere(g,.17,.44,.47,P.yellow,sign*.76,1.22,.08).rotation.z=sign*.25;
    sphere(g,.067,.075,.035,P.ink,sign*.29,2.79,.53);
  }
  sphere(g,.35,.27,.5,P.yellow,0,.84,-.66).rotation.x=.4;
  door(g,0,.2,.73,.79,.36);
  for(const sign of [-1,1])windowPane(g,sign*.52,1.5,.64,.28,.35,sign*.4);
  cylinder(g,.59,.59,.09,P.metal,0,3.13,0,16);
  cylinder(g,.46,.46,.47,P.cream,0,3.4,0,12);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    box(g,.035,.51,.035,P.metal,Math.cos(a)*.445,3.4,Math.sin(a)*.445);
  }
  const lamp=group();lamp.name='lighthouse-lantern';g.add(lamp);
  sphere(lamp,.16,.2,.16,P.yellow,0,3.41,0);
  cone(g,.63,.38,P.red,0,3.83,0,12);
  sphere(g,.075,.12,.075,amber,0,4.08,0);
  return g;
}
function littleLibrary(){
  const g=group();
  box(g,2.3,.12,1.37,P.stone,0,.06,0);
  box(g,2.14,1.18,.14,P.cream,0,.7,-.57);
  for(const x of [-1,1]){
    box(g,.15,1.3,1.15,P.cream,x,.76,-.02);
    box(g,.12,1.37,.12,P.white,x,.8,.58);
  }
  // Broad pale roof with a shallow, charming zig-zag gable like Reading Hill.
  extrude(g,[[-1.28,0],[-.67,.19],[0,.04],[.65,.19],[1.28,0],[1.28,.13],[.65,.32],[0,.17],[-.67,.32],[-1.28,.13]],1.52,P.cream,0,1.4,-.76,.025);
  box(g,1.46,.23,.12,P.white,0,1.22,.63);
  label(g,'THE LITTLE LIBRARY',1.38,.18,0,1.22,.704,'#ffffff');
  door(g,0,.12,-.44,.92,.42);
  for(const side of [-1,1]){
    const shelf=group();put(g,shelf,side*.68,.25,-.33);
    box(shelf,.44,.67,.22,P.wood,0,.32,0);
    for(const yy of [.08,.32,.55]){
      box(shelf,.4,.03,.26,P.cream,0,yy,.01);
      for(let j=0;j<4;j++)box(shelf,.063,.16+(j%2)*.025,.16,[P.pink,P.yellow,P.blue,P.leaf][j],-.14+j*.093,yy+.1,.06);
    }
  }
  box(g,.64,.12,.36,P.purple,0,.16,.53);
  return g;
}

export const buildingsFactories={
  cottage:()=>house('cottage'),townhouse:()=>house('townhouse'),'pond-house':()=>house('pond-house'),
  bakery:()=>house('bakery'),library:()=>house('library'),cafe:()=>house('cafe'),kiosk,
  'stall-bread':()=>stall('bread'),'stall-fruit':()=>stall('fruit'),'stall-flower':()=>stall('flower'),
  'stall-ice-cream':()=>stall('ice-cream'),gazebo,'lighthouse-duck':lighthouse,'little-library':littleLibrary,
};
