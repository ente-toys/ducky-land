export function waterPoint(t) {
 const u=1-t;
 return {x:u*u*u*-170+3*u*u*t*-217+3*u*t*t*-265+t*t*t*-263,
 y:u*u*u*-276+3*u*u*t*-282+3*u*t*t*-218+t*t*t*-76};
}
export function waterFrame(seconds,reduced=false) {
 return {flecks:Array.from({length:9},(_,i)=>waterPoint(((reduced?0:seconds*.78)+i/9)%1)),
 rings:Array.from({length:3},(_,i)=>((reduced?.3:seconds*.85)+i/3)%1)};
}
export function createFairWater({Graphics,Container},props,objects,origin={x:3570,y:2737.5}) {
 const fallback=props.find(p=>p.id==='fair-centre-water');
 const root=new Container({label:'Fair teapot pouring water'});root.position.set(origin.x,origin.y);root.zIndex=origin.y+36;
 const stream=new Graphics();
 stream.moveTo(-170,-276).bezierCurveTo(-217,-282,-265,-218,-263,-76).stroke({color:0x39472D,width:17,cap:'round'});
 stream.moveTo(-170,-276).bezierCurveTo(-217,-282,-265,-218,-263,-76).stroke({color:0x84DCE5,width:12,cap:'round'});
 const foam=new Graphics();root.addChild(stream,foam);objects.addChild(root);
 if(fallback)fallback.sprite.alpha=0;
 return {root,update(seconds,reduced=false,visible=true){root.visible=visible;if(!visible)return;
  const frame=waterFrame(seconds,reduced);foam.clear();
  for(const p of frame.flecks)foam.ellipse(p.x,p.y,2.1,4).fill(0xFFF8D8);
  for(const t of frame.rings)foam.ellipse(-263,-70,8+t*35,3+t*10).stroke({color:0xFFF8D8,width:2.4,alpha:1-t});
  if(!reduced)for(let i=0;i<3;i++){const t=(seconds*1.2+i/3)%1;foam.circle(-263+(i-1)*26*t,-73-38*Math.sin(t*Math.PI),2.6*(1-t*.6)).fill({color:0xD7F5EF,alpha:1-t});}
 },destroy(){if(fallback&&!fallback.sprite.destroyed)fallback.sprite.alpha=1;root.destroy({children:true})}};
}
