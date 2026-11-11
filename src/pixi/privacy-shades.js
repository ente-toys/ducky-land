import {Container,Sprite} from 'pixi.js';

// Separate SVG lenses ride the real, glided eye seats. The joints themselves
// blink/squint, so glasses share their position and tilt, never their blink scale.
export function createPrivacyShades(view,art){
 const root=new Container({label:'Privacy sunglasses'}),eyes=view.parts.filter(p=>p.role==='eye');
 const bridge=new Sprite({texture:art.bridge,label:'Privacy shades bridge'});
 bridge.anchor.set(0,.5);root.addChild(bridge);
 const lenses=eyes.map(eye=>{
  const sprite=new Sprite({texture:art.lens,label:`Privacy lens ${eye.id}`});
  // The original eye centre is only a few units above the beak. Seat the
  // bold frame above that centre so its lower rim clears the bill.
  sprite.anchor.set(.5,56/72);root.addChild(sprite);return {eye,sprite};
 });
 const [left,right]=[...lenses].sort((a,b)=>a.eye.joint.rest.x-b.eye.joint.rest.x);
 view.body.addChild(root);
 return {root,update(angle){
  const degrees=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle))*180/Math.PI);
  const side=Math.sign(Math.sin(angle))||1,near=eyes.reduce((a,b)=>!a||b.joint.rest.x*side>a.joint.rest.x*side?b:a,null);
  const back=degrees>=112.5;
  root.visible=!back&&eyes.length>0;
  for(const {eye,sprite}of lenses){
   const far=eyes.length>1&&eye!==near;
   sprite.visible=!back&&(!far||degrees<=52);
   sprite.position.copyFrom(eye.joint.position);sprite.rotation=eye.joint.rotation;
   // Side view uses one narrow lens; the far lens tucks behind the head.
   const k=1-.45*Math.sin(degrees*Math.PI/180)**2;
   sprite.scale.set((eyes.length===1?side:eye===near?side:-side)*k,1);
   if(eyes.length===1)sprite.scale.x*=eye.joint.scale.x;
  }
  bridge.visible=root.visible&&lenses.length===2&&left.sprite.visible&&right.sprite.visible;
  if(bridge.visible){
   const ax=left.sprite.x+39*Math.sin(left.sprite.rotation),ay=left.sprite.y-39*Math.cos(left.sprite.rotation);
   const bx=right.sprite.x+39*Math.sin(right.sprite.rotation),by=right.sprite.y-39*Math.cos(right.sprite.rotation),dx=bx-ax,dy=by-ay;
   bridge.position.set(ax,ay);
   bridge.rotation=Math.atan2(dy,dx);bridge.scale.set(Math.hypot(dx,dy)/100,1);
  }
 }};
}
