import {createDuck} from '../src/rendering/pixi/duck.js';
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const descendants=node=>[node,...node.children.flatMap(descendants)];
export async function verifyWardrobe(wardrobe){
 let directions=0,actions=0;
 for(const entry of wardrobe){
  const duck=await createDuck({outfit:{[entry.slot]:entry.index}});
  try{
   for(const angle of [0,45,90,135,180,-135,-90,-45]){
    for(let i=0;i<24;i++)duck.update(.1,{turn:angle*Math.PI/180,reducedMotion:true});
    const views=duck.root.children[0].children.filter(node=>(node.label||'').startsWith('Direction ')&&node.visible);
    assert(views.length===1,`${entry.id}: exactly one direction must be visible`);
    assert(views[0].label===`Direction ${angle}`,`${entry.id}: wrong directional rig`);
    const garments=descendants(views[0]).filter(node=>node.label===entry.id);
    assert(garments.length===entry.frames[String(angle)].filter(frame=>frame.visible).length,`${entry.id}: missing or duplicate garments`);
    const parts=descendants(views[0]);
    if(entry.slot==='shoes')assert(parts.filter(node=>(node.label||'').startsWith('foot-')).every(node=>!node.visible),`${entry.id}: bare feet visible beneath shoes`);
    if(entry.slot==='cap'&&![12,13].includes(entry.sourceNumber))assert(parts.filter(node=>(node.label||'').startsWith('tuft-')).every(node=>!node.visible),`${entry.id}: tuft pokes through hat`);
    for(let action=0;action<10;action++){
     for(let frame=0;frame<5;frame++)duck.update(.1,{turn:angle*Math.PI/180,action,speed:action===1?165:0});
     const bounds=duck.root.getBounds();
     assert([bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite),`${entry.id}: invalid animation bounds`);
     assert(bounds.width<650&&bounds.height<650,`${entry.id}: accessory jumps away during animation`);
     actions++;
    }
    directions++;
   }
   const nodes=descendants(duck.root).filter(node=>node.label===entry.id);
   await duck.setOutfit({});
   assert(nodes.every(node=>node.destroyed),`${entry.id}: outfit leaves stale garments`);
   const visible=duck.root.children[0].children.find(node=>(node.label||'').startsWith('Direction ')&&node.visible);
   assert(descendants(visible).filter(node=>(node.label||'').startsWith('foot-')).every(node=>node.visible),`${entry.id}: bare feet not restored`);
  }finally{duck.dispose();}
 }
 const combined=await createDuck({outfit:{cap:2,shades:1,acc:4,shoes:2}});
 try{
  const signature=()=>descendants(combined.root).map(node=>node.label).filter(label=>/^(cap|shades|acc|shoes)-/.test(label)).join(',');
  const before=signature();
  await combined.setOutfit({shoes:2,acc:4,shades:1,cap:2});
  assert(signature()===before,'outfit property order changes garment layering');
 }finally{combined.dispose();}
 return `PASS: ${directions} directions; ${actions} action cases; outfit cleanup`;
}
