// Presentation only. Authoritative impacts drive the same response for every Ducky.
export function createPaintHitReactions(){
  const reactions=new Map(),modified=[];let lastTick=-1,lastSplat=0;
  function restore(){
    for(const s of modified)if(!s.root.destroyed){s.root.position.set(s.x,s.y);s.root.rotation=s.rotation;s.root.scale.set(s.sx,s.sy);}
    modified.length=0;
  }
  return {
    beginFrame:restore,
    observe(snapshot){
      if(snapshot.tick===lastTick)return;
      if(lastTick<0||snapshot.tick<lastTick){lastTick=snapshot.tick;lastSplat=Math.max(0,...snapshot.splats.map(s=>s.id));reactions.clear();return;}
      lastTick=snapshot.tick;
      const players=new Map(snapshot.players.map(p=>[p.id,p]));
      for(const s of snapshot.splats){
        if(s.id<=lastSplat)continue;
        if(!['hit','shield'].includes(s.kind)||snapshot.time-s.born>.3)continue;
        const p=players.get(s.victim);if(!p?.alive)continue;
        const previous=reactions.get(p.id);if(previous&&s.born-previous.at<.12)continue;
        let dx=p.x-s.x,dy=p.y-s.y,n=Math.hypot(dx,dy);if(n<.001){dx=s.id%2?1:-1;dy=0;n=1;}
        reactions.set(p.id,{at:s.born,dx:dx/n,dy:dy/n});
      }
      for(const s of snapshot.splats)lastSplat=Math.max(lastSplat,s.id);
      for(const id of reactions.keys())if(!players.get(id)?.alive)reactions.delete(id);
    },
    apply(id,rig,time,reducedMotion=false){
      const hit=reactions.get(id),root=rig.root;if(!hit||root.destroyed)return;
      const age=Math.max(0,time-hit.at);if(age>.34){reactions.delete(id);return;}if(reducedMotion)return;
      const wave=Math.cos(age*38)*Math.exp(-age*12),squash=Math.sin(age*38)*Math.exp(-age*12);
      modified.push({root,x:root.x,y:root.y,rotation:root.rotation,sx:root.scale.x,sy:root.scale.y});
      root.x+=hit.dx*3*wave;root.y+=hit.dy*2*wave;
      root.rotation+=Math.sin(age*38+.8)*Math.exp(-age*12)*.085*(hit.dx>=0?1:-1);
      root.scale.set(root.scale.x*(1+squash*.045),root.scale.y*(1-squash*.035));
    },
    dispose(){restore();reactions.clear();},
  };
}
