// Familiar island shapes made from existing stars. Never add or move a star.
const SHAPES=[
  {name:'duck',center:[-.65,.16],size:.24,points:[[-.9,0],[-.55,.2],[-.4,.65],[-.1,.85],[.2,.6],[.25,.15],[.65,.05],[.95,.3],[.8,-.25],[.35,-.6],[-.2,-.55],[-.65,-.3]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,0]]},
  {name:'boat',center:[.68,-.3],size:.25,points:[[-1,-.15],[1,-.15],[.6,-.65],[-.65,-.65],[0,-.15],[0,.95],[-.85,.05],[.7,.05]],edges:[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,4],[5,7],[7,4]]},
  {name:'telescope',center:[.12,.04],size:.26,behind:true,points:[[-.8,.4],[.55,.85],[.75,.35],[-.6,-.1],[0,.1],[0,-.65],[-.65,-.9],[.65,-.9]],edges:[[0,1],[1,2],[2,3],[3,0],[4,5],[4,6],[4,7]]},
];
export function themedConstellations(stars,heading){
  const used=new Set(),lines=[],groups=[];
  for(const shape of SHAPES){
    const yaw=heading.yaw+(shape.behind?Math.PI:0),pitch=shape.behind?0:heading.pitch;
    const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
    const chosen=[];
    for(const [u,v]of shape.points){
      const lx=shape.center[0]+u*shape.size,ly=shape.center[1]+v*shape.size,z0=cp-sp*ly;
      let x=cy*lx+sy*z0,y=cp*ly+sp,z=-sy*lx+cy*z0;const length=Math.hypot(x,y,z);x/=length;y/=length;z/=length;
      let best=null,score=.995;
      for(const star of stars){if(star.login||star.radius<320||used.has(star.index))continue;const dot=(star.x*x+star.y*y+star.z*z)/star.radius;if(dot>score){score=dot;best=star;}}
      if(!best)break;used.add(best.index);chosen.push(best);
    }
    if(chosen.length!==shape.points.length)continue;
    groups.push({name:shape.name,stars:chosen});
    for(const [a,b]of shape.edges)lines.push([chosen[a],chosen[b]]);
  }
  return {lines,groups};
}
