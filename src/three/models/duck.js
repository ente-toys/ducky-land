import { THREE, P, group, mesh, sphere, mat } from './primitives.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWardrobe } from './wardrobe.js';

export const duckAnimationNames=Object.freeze({0:'idle',1:'walk',2:'quack',3:'dance',4:'heart',5:'laugh',6:'wave',7:'sleep',8:'grumpy',9:'party'});
const YELLOW=0xffd525, ORANGE=0xff814a, INK=0x232323;
const baseSphere=new THREE.SphereGeometry(1,16,12);
const pearProfile=[
  [0,.06],[.20,.07],[.36,.12],[.45,.22],[.50,.36],[.51,.52],[.48,.70],
  [.43,.90],[.39,1.08],[.37,1.24],[.33,1.36],[.26,1.46],[.15,1.52],[0,1.55],
];
const pear=new THREE.LatheGeometry(pearProfile.map(([r,y])=>new THREE.Vector2(r,y)),28);
// A curved color patch follows the torso surface; it cannot intersect into a crescent.
const bellyGeometry=(()=>{
  const vertices=[],indices=[],rings=10,segments=36;
  function point(u,v){const y=.50+v*.37,x=u*.34;let i=1;while(i<pearProfile.length-1&&pearProfile[i][1]<y)i++;const [r0,y0]=pearProfile[i-1],[r1,y1]=pearProfile[i],r=THREE.MathUtils.lerp(r0,r1,(y-y0)/(y1-y0));return[x,y,Math.sqrt(Math.max(0,r*r-x*x))+.006];}
  vertices.push(...point(0,0));
  for(let ring=1;ring<=rings;ring++)for(let segment=0;segment<segments;segment++){const a=segment/segments*Math.PI*2;vertices.push(...point(Math.cos(a)*ring/rings,Math.sin(a)*ring/rings));}
  for(let j=0;j<segments;j++)indices.push(0,1+j,1+(j+1)%segments);
  for(let r=1;r<rings;r++)for(let j=0;j<segments;j++){const a=1+(r-1)*segments+j,b=1+(r-1)*segments+(j+1)%segments,c=1+r*segments+j,d=1+r*segments+(j+1)%segments;indices.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
})();
const combine=specs=>mergeGeometries(specs.map(([x,y,z,sx,sy,sz,rz=0])=>baseSphere.clone().scale(sx,sy,sz).rotateZ(rz).translate(x,y,z)));
const tuftGeometry=combine([[-.037,0,0,.055,.14,.060,-.28],[.055,.025,0,.065,.13,.06,-.65]]);
const eyesGeometry=combine([[-.135,0,0,.031,.040,.021],[.135,0,0,.031,.040,.021]]);
const glintsGeometry=combine([[-.144,.012,.017,.009,.010,.006],[.126,.012,.017,.009,.010,.006]]);
const browGeometry=combine([[-.135,.070,0,.060,.014,.015,-.28],[.135,.070,0,.060,.014,.015,.28]]);
const footGeometry=combine([[0,-.022,.08,.19,.065,.245],[0,.004,-.035,.10,.055,.10]]);
const tailGeometry=combine([[0,0,-.02,.14,.09,.22,0],[.09,.015,.02,.12,.07,.19,-.2],[-.09,.015,.02,.12,.07,.19,.2]]);
const heartShape=new THREE.Shape();heartShape.moveTo(0,-.7);heartShape.bezierCurveTo(-1,.0,-.8,.7,-.4,.7);heartShape.bezierCurveTo(-.15,.7,0,.48,0,.34);heartShape.bezierCurveTo(.10,.56,.20,.7,.42,.7);heartShape.bezierCurveTo(.9,.7,1,0,0,-.7);
const heartGeometry=new THREE.ExtrudeGeometry(heartShape,{depth:.25,bevelEnabled:true,bevelSegments:2,bevelSize:.06,bevelThickness:.06,curveSegments:8,steps:1});

function joint(parent,name,x=0,y=0,z=0){const g=group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}
// All clips key the same articulated channels, so crossfades never retain a stale pose.
const channels={
  'Body.position[y]':.08,'Body.rotation[x]':0,'Body.rotation[z]':0,
  'Head.rotation[x]':0,'Head.rotation[y]':0,'Head.rotation[z]':0,
  'WingL.rotation[x]':0,'WingR.rotation[x]':0,'WingL.rotation[z]':-.16,'WingR.rotation[z]':.16,
  'FootL.rotation[x]':0,'FootR.rotation[x]':0,'FootL.position[y]':.075,'FootR.position[y]':.075,
  'FootL.position[z]':.06,'FootR.position[z]':.06,'BeakLower.rotation[x]':0,'Tail.rotation[y]':0,
};
const durations=[3.2,.72,1.25,1.7,2.2,1.35,1.8,4,2.4,1.25];
function pose(action,t){
  const p={...channels},a=t*Math.PI*2,s=Math.sin(a),c=Math.cos(a);
  const set=(k,v)=>{p[k]=v;};
  set('Body.position[y]',.08+Math.sin(a)*.008);set('Body.rotation[z]',Math.sin(a)*.018);set('Head.rotation[y]',Math.sin(a)*.035);set('Tail.rotation[y]',Math.sin(a)*.045);
  switch(action){
    case 1:
      set('Body.position[y]',.08+Math.abs(s)*.035);set('Body.rotation[z]',s*.065);set('Body.rotation[x]',.035);
      set('FootL.rotation[x]',s*.36);set('FootR.rotation[x]',-s*.36);
      set('FootL.position[y]',.075+Math.max(0,s)*.10);set('FootR.position[y]',.075+Math.max(0,-s)*.10);
      set('FootL.position[z]',.06+s*.10);set('FootR.position[z]',.06-s*.10);
      set('WingL.rotation[x]',-s*.23);set('WingR.rotation[x]',s*.23);set('Head.rotation[y]',-s*.025);break;
    case 2:
      set('Head.rotation[x]',-.10-Math.max(0,s)*.08);set('BeakLower.rotation[x]',Math.max(0,s)*.55);set('WingL.rotation[z]',-.23-Math.max(0,s)*.10);set('WingR.rotation[z]',.23+Math.max(0,s)*.10);break;
    case 3:
      set('Body.rotation[z]',s*.18);set('Body.position[y]',.08+Math.abs(s)*.05);set('Head.rotation[z]',-s*.12);set('Head.rotation[y]',s*.18);
      set('WingL.rotation[z]',-.45-s*.37);set('WingR.rotation[z]',.45-s*.37);set('WingL.rotation[x]',c*.3);set('WingR.rotation[x]',-c*.3);
      set('FootL.position[y]',.075+Math.max(0,-s)*.07);set('FootR.position[y]',.075+Math.max(0,s)*.07);set('Tail.rotation[y]',s*.30);break;
    case 4:
      set('Head.rotation[z]',s*.07);set('Head.rotation[x]',-.08);set('WingL.rotation[z]',-.64);set('WingR.rotation[z]',.64);set('WingL.rotation[x]',-.60);set('WingR.rotation[x]',-.60);set('Body.position[y]',.08+(1-c)*.018);break;
    case 5:
      set('Body.rotation[x]',.07+Math.sin(a*3)*.04);set('Body.position[y]',.08+Math.abs(Math.sin(a*3))*.025);set('Head.rotation[x]',-.15+Math.sin(a*3)*.06);set('BeakLower.rotation[x]',.25+Math.max(0,Math.sin(a*3))*.22);set('WingL.rotation[z]',-.35);set('WingR.rotation[z]',.35);break;
    case 6:
      set('WingR.rotation[z]',2.25+Math.sin(a*3)*.28);set('WingR.rotation[x]',-.25);set('Body.rotation[z]',-.06);set('Head.rotation[z]',-.08);set('Head.rotation[y]',-.08);break;
    case 7:
      set('Body.position[y]',.055+s*.007);set('Body.rotation[x]',.04);set('Head.rotation[x]',.13+s*.025);set('Head.rotation[z]',.07);set('WingL.rotation[z]',-.06);set('WingR.rotation[z]',.06);break;
    case 8:
      set('Body.rotation[z]',s*.025);set('Head.rotation[x]',.07);set('Head.rotation[y]',s*.12);set('WingL.rotation[z]',-.55);set('WingR.rotation[z]',.55);set('WingL.rotation[x]',-.5);set('WingR.rotation[x]',-.5);set('FootR.position[y]',.075+Math.max(0,Math.sin(a*3))*.035);break;
    case 9:
      set('Body.position[y]',.08+Math.max(0,s)*.16);set('Body.rotation[z]',c*.12);set('Head.rotation[y]',s*.25);set('WingL.rotation[z]',-1.35-s*.28);set('WingR.rotation[z]',1.35+s*.28);set('BeakLower.rotation[x]',.15+Math.max(0,c)*.15);set('FootL.position[y]',.075+Math.max(0,s)*.10);set('FootR.position[y]',.075+Math.max(0,s)*.10);set('Tail.rotation[y]',s*.25);break;
  }
  return p;
}
const clips=Object.keys(duckAnimationNames).map(key=>{
  const action=Number(key),duration=durations[action],frames=action===0||action===7?24:40,times=Array.from({length:frames+1},(_,i)=>i/frames*duration),poses=times.map(t=>pose(action,t/duration));
  const tracks=Object.keys(channels).map(channel=>new THREE.NumberKeyframeTrack(channel,times,poses.map(p=>p[channel])));
  return new THREE.AnimationClip(duckAnimationNames[action],duration,tracks);
});

/** Ground is Y=0; +Z faces forward. Root yaw/translation belong to the world engine. */
export function createDuck({outfit={cap:8,shades:1,acc:0,shoes:2},seed=0}={}){
  const root=group();root.name='Ducky';
  const body=joint(root,'Body',0,.08,0);
  const bodyMesh=mesh(body,pear,YELLOW);bodyMesh.name='Pear shaped body';
  // A thin inverted hull preserves the original illustrated silhouette from every angle.
  const outline=new THREE.Mesh(pear,mat(INK,{side:THREE.BackSide}));outline.scale.set(1.018,1.007,1.018);body.add(outline);
  mesh(body,bellyGeometry,0xffe34c).name='Belly';
  const head=joint(body,'Head',0,1.225,0);
  const tuft=joint(head,'Tuft',.025,.335,-.015);mesh(tuft,tuftGeometry,YELLOW);
  const expression=joint(head,'Expression',0,.025,.354);
  const eyes=joint(expression,'Eyes');mesh(eyes,eyesGeometry,INK);mesh(eyes,glintsGeometry,P.white);
  const eyebrows=mesh(expression,browGeometry,INK);eyebrows.visible=false;
  const beak=joint(head,'Beak',0,-.085,.355);
  sphere(beak,.148,.045,.155,ORANGE,0,.005,.075).name='Upper bill';
  const lower=joint(head,'BeakLower',0,-.092,.36);
  sphere(lower,.135,.029,.143,ORANGE,0,-.035,.075).name='Lower bill';
  sphere(beak,.118,.009,.125,INK,0,-.028,.077).name='Mouth seam';
  const wingL=joint(body,'WingL',-.435,.89,-.005),wingR=joint(body,'WingR',.435,.89,-.005);
  for(const [wing,side]of [[wingL,-1],[wingR,1]]){sphere(wing,.115,.285,.16,YELLOW,side*.025,-.19,.025);wing.rotation.z=side*.16;}
  const tail=joint(body,'Tail',0,.30,-.41);mesh(tail,tailGeometry,YELLOW);tail.rotation.x=.2;
  const footL=joint(root,'FootL',-.22,.075,.06),footR=joint(root,'FootR',.22,.075,.06);
  const feet=[mesh(footL,footGeometry,ORANGE),mesh(footR,footGeometry,ORANGE)];
  const capAnchor=joint(head,'CapAnchor',0,.285,0),shadesAnchor=joint(head,'ShadesAnchor',0,.025,.388),accAnchor=joint(body,'AccessoryAnchor',0,.94,0);
  const heart=mesh(body,heartGeometry,0xff699b,0,1.02,.57);heart.name='Love heart';heart.scale.setScalar(.13);heart.visible=false;
  const attached=[];
  function dress(next){
    for(const item of attached){item.removeFromParent();item.traverse(n=>{if(n.geometry?.userData.wardrobeOwned)n.geometry.dispose();});}attached.length=0;feet.forEach(f=>f.visible=true);
    for(const [slot,anchor]of [['cap',capAnchor],['shades',shadesAnchor],['acc',accAnchor]]){if(!next[slot])continue;const garment=createWardrobe(slot,next[slot]);anchor.add(garment);attached.push(garment);}
    if(next.shoes){const pair=createWardrobe('shoes',next.shoes);const shoes=pair.userData.footwear;if(shoes){for(const [i,foot]of [footL,footR].entries()){const shoe=shoes[i];shoe.position.x=0;foot.add(shoe);attached.push(shoe);feet[i].visible=false;}}}
    root.userData.outfit={...next};
  }
  dress(outfit);
  const mixer=new THREE.AnimationMixer(root),actions=clips.map(clip=>mixer.clipAction(clip));let current=0,elapsed=0,disposed=false,lastEmoteVersion=0;
  actions[0].play();actions[0].time=(Math.abs(seed)*.618%1)*durations[0];
  const phase=(Math.abs(seed)*1.618)%4.7;
  root.userData.rig={body,head,beak,lower,wingL,wingR,footL,footR,tail,expression,capAnchor,shadesAnchor,accAnchor};
  root.userData.animationNames=duckAnimationNames;
  function update(dt,{action=0,speed=0,turn=0,time,reducedMotion=false,emoteVersion=0}={}){
    if(disposed)return;
    dt=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;elapsed+=dt;
    const numeric=typeof action==='string'?Number(Object.entries(duckAnimationNames).find(([,name])=>name===action)?.[0]??0):Number(action);
    const requested=Number.isInteger(numeric)&&numeric>=0&&numeric<=9?numeric:0;
    if(requested!==current){const previous=actions[current],next=actions[requested];next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();previous.crossFadeTo(next,reducedMotion?.1:.24,false);current=requested;}else if(requested>1&&emoteVersion!==lastEmoteVersion)actions[current].reset().play();lastEmoteVersion=emoteVersion;
    actions[current].timeScale=reducedMotion?.12:current===1?Math.min(1.9,.75+Math.max(0,Number(speed)||0)*.30):1;
    mixer.update(dt);
    const t=Number.isFinite(time)?time:elapsed;
    // Turning lag stays below the root: the scene owns root.rotation.y throughout.
    head.rotation.y+=THREE.MathUtils.clamp(Number(turn)||0,-1,1)*(reducedMotion?.015:.075);
    const blinkCycle=(t+phase)%4.7,blink=blinkCycle<.11?Math.max(.06,Math.abs(blinkCycle-.055)/.055):1;
    eyes.scale.y=current===7?.12:current===5?.55:blink;
    eyebrows.visible=current===8;
    heart.visible=current===4;heart.scale.setScalar(.13*(reducedMotion?1:1+Math.sin(t*4)*.07));heart.position.y=1.02+(reducedMotion?0:Math.sin(t*2)*.03);
    // Gentle volume change, independent of the action mixer, gives the torso breath.
    const breath=reducedMotion?0:Math.sin((t+phase)*1.7)*.006;bodyMesh.scale.set(1-breath*.4,1+breath,1-breath*.3);
  }
  function dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(root);for(const item of attached)item.traverse(n=>{if(n.geometry?.userData.wardrobeOwned)n.geometry.dispose();});root.removeFromParent();}
  return {root,update,dispose,setOutfit:dress,mixer,clips,parts:root.userData.rig};
}
