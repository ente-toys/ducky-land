export const LEAVES_PER_TREE=3,LEAF_POOL_LIMIT=96,MOBILE_LEAF_POOL_LIMIT=48;
export function autumnLeafPose(tree,time,index,out={}){
 const period=7.8+(index%3)*.9,age=((time+index*2.731)%period+period)%period;
 const falling=period-2.3,u=Math.min(1,age/falling),phase=index*1.618;
 const width=tree.width*(tree.scale??1),height=tree.height*(tree.scale??1);
 const startX=tree.x+Math.sin(phase)*width*.22,startY=tree.y-height*(.48+(index%3)*.13);
 const sway=Math.sin(u*Math.PI*3+phase)-Math.sin(phase);
 out.x=startX+u*18+sway*14*(1-u);
 out.y=startY+(tree.y+3-startY)*u;
 out.rotation=phase+u*Math.PI*(index%2?2:-2)+Math.sin(u*Math.PI*4)*.32*(1-u);
 out.alpha=age<.45?age/.45:age<falling+.8?1:Math.min(1,Math.max(0,1-(age-falling-.8)/1.5));
 out.scale=.72+(index%3)*.12;
 out.settled=age>=falling;
 return out;
}
export function createAutumnLeafPool(trees,makeSprite,{mobile=false,maxSprites=LEAF_POOL_LIMIT}={}){
 const limit=Math.min(mobile?MOBILE_LEAF_POOL_LIMIT:LEAF_POOL_LIMIT,maxSprites);
 const slots=Array.from({length:limit},(_,i)=>({sprite:makeSprite(i),tree:null,index:i,pose:{}}));
 const selected=[];let nextSelection=-Infinity,created=slots.length;
 const hide=()=>{for(const slot of slots)slot.sprite.visible=false;};
 return {slots,get stats(){return {created,active:slots.filter(s=>s.sprite.visible).length,trees:selected.length,limit};},
  update(time,reduced,visible,{x=0,y=0,zoom=1,shown=true}={}){
   if(reduced||!shown||zoom<.28){hide();nextSelection=-Infinity;return;}
   if(time>=nextSelection||time<nextSelection-.5){
    selected.length=0;
    for(const tree of trees)if(visible(tree.x,tree.y-tree.height*.4,tree.width*.5)&&Math.hypot(tree.x-x,(tree.y-y)*.8)<1800)selected.push(tree);
    selected.sort((a,b)=>(a.x-x)**2+(a.y-y)**2-((b.x-x)**2+(b.y-y)**2));
    selected.length=Math.min(selected.length,Math.floor(limit/LEAVES_PER_TREE));
    for(let i=0;i<slots.length;i++)slots[i].tree=selected[Math.floor(i/LEAVES_PER_TREE)]??null;
    nextSelection=time+.35;
   }
   for(const slot of slots){const {sprite,tree,index,pose}=slot;
    if(!tree||!visible(tree.x,tree.y-tree.height*.35,tree.height)){sprite.visible=false;continue;}
    autumnLeafPose(tree,time,index,pose);sprite.visible=true;sprite.position.set(pose.x,pose.y);sprite.rotation=pose.rotation;sprite.alpha=pose.alpha;sprite.scale.set(pose.scale);
   }
  },
  destroy(){hide();for(const slot of slots)slot.sprite.destroy();selected.length=0;created=0;},
 };
}
