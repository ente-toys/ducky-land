import {Container,Graphics,Sprite} from 'pixi.js';

// Attached to the original articulated body, including its walk and turn.
export function createKarmaQuiver(view,texture){
  const root=new Container({label:'Karma feather quiver'}),pouch=new Container(),strap=new Graphics();
  const rear=new Container({label:'Quiver behind body'}),strapMask=new Graphics({label:'Sling body clip'});
  const ink=0x59412a;
  root.visible=false;rear.visible=false;
  // Place the front sling under the wings, beak and wardrobe, rather than
  // drawing a detached line over all of the Ducky's parts.
  view.body.addChildAt(rear,0);
  // Rear tail artwork includes a yellow fill. Seat the quiver above that
  // fill, while keeping the nearer wing and wardrobe on their original layers.
  const bodyIndex=Math.max(view.body.children.indexOf(view.bodyPart?.joint),
    ...(view.parts??[]).filter(part=>part.role==='tail').map(part=>view.body.children.indexOf(part.joint)));
  view.body.addChildAt(root,bodyIndex>=0?bodyIndex+1:view.body.children.length);
  root.addChild(strap,strapMask);strap.mask=strapMask;
  let lastAngle=NaN;
  function fit(angle,glide){
    // One continuous sling wrapped around the torso. Only its near hemisphere
    // is drawn; the hidden half continues behind the Ducky, without loose ends.
    const step=Math.round(angle*256)/256;
    if(step===lastAngle)return;
    lastAngle=step;strap.clear();
    const upper=[],lower=[];
    for(let n=0;n<=40;n++){
      const t=-Math.PI/2+n*Math.PI/40,phi=t-angle;
      const x=240*Math.sin(t),y=-302-120*Math.sin(phi);
      const half=7*Math.sqrt(Math.max(0,Math.cos(t)));
      upper.push(x,y-half);lower.unshift(x,y+half);
    }
    strap.poly([...upper,...lower]).fill(0xa66b3c).stroke({color:ink,width:4,join:'round'});
    strapMask.clear();
    const body=view.spec.morph?.body,other=glide?.other?.spec.morph?.body,w=glide?.w??0;
    if(body)strapMask.poly(body.flatMap(([x,y],i)=>[
      x+((other?.[i]?.[0]??x)-x)*w,y+((other?.[i]?.[1]??y)-y)*w,
    ])).fill(0xffffff);
    else strapMask.roundRect(-205,-550,410,520,150).fill(0xffffff);
    const backFacing=Math.cos(angle)<.001;
    (backFacing?root:rear).addChild(pouch);
    pouch.x=-173*Math.sin(angle);
    pouch.rotation=-.14*Math.cos(angle-Math.PI);
    pouch.scale.set(1.18);
  }

  // Back rim first, then feathers, then the front leather. The shafts disappear
  // into the dark opening instead of hovering above it.
  pouch.addChild(new Graphics().ellipse(0,0,53,19).fill(0x503722).stroke({color:ink,width:7}));
  const feathers=[];
  for(let n=0;n<5;n++){
    const feather=new Sprite(texture);feather.anchor.set(.24,.91);feather.width=76;feather.height=108;
    feather.position.set((n-2)*15,23+Math.abs(n-2)*4);
    feather.rotation=-.48+(n-2)*.16;
    feathers.push(feather);pouch.addChild(feather);
  }
  const leather=new Graphics()
    .moveTo(-52,2).quadraticCurveTo(-49,111,-29,137)
    .quadraticCurveTo(0,159,31,136).quadraticCurveTo(49,111,52,2)
    .quadraticCurveTo(0,27,-52,2).closePath().fill(0xad7545).stroke({color:ink,width:8,join:'round'});
  leather.moveTo(31,17).quadraticCurveTo(34,100,12,143)
    .quadraticCurveTo(37,136,43,108).lineTo(51,6).closePath().fill(0x87532f);
  // Rolled cuff and a simple sewn seam keep the small silhouette readable.
  leather.moveTo(-51,3).quadraticCurveTo(0,28,51,3).lineTo(49,24)
    .quadraticCurveTo(0,48,-49,24).closePath().fill(0xc4945e).stroke({color:ink,width:6,join:'round'});
  leather.moveTo(-33,45).quadraticCurveTo(-31,112,-17,128).stroke({color:0xd8ad78,width:3,cap:'round'});
  leather.roundRect(-23,68,46,38,9).fill(0x946036).stroke({color:ink,width:4});
  leather.circle(0,86,7).fill(0xe9bc50).stroke({color:ink,width:3});
  pouch.addChild(leather);
  let count=0,age=10;
  return {
    update(dt,total,reduced,angle=view.spec.angle*Math.PI/180,glide){
      root.visible=total>0;rear.visible=total>0;
      fit(angle,glide);
      if(total>count)age=0;count=total;age+=dt;
      const wobble=reduced?0:Math.exp(-age*10)*Math.sin(age*24);
      pouch.y=-295-wobble*14;pouch.scale.set(1.18*(1+wobble*.035));
      feathers.forEach((f,n)=>f.visible=n<Math.min(5,total));
    },
    get target(){return {x:pouch.x/3,y:pouch.y/3};},
  };
}
