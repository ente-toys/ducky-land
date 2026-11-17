import {Assets,Container,Point,Sprite} from 'pixi.js';
import guns from './assets/guns.json' with {type:'json'};
import {holdingWingTilt} from './muzzle.js';
import {loadEvilLook,loadKarmaLook} from './team-look.js';

let loading;
export function loadGunC() {
  const urls=import.meta.glob('./assets/*.svg',{query:'?url',import:'default',eager:true});
  return loading??=Promise.all([
    Promise.all(guns.map(async spec=>({...spec,texture:await Assets.load(urls[`./assets/${spec.file}`])}))),loadEvilLook(),loadKarmaLook(),
  ]).then(([items,evilLook,karmaLook])=>Object.assign(items,{evilLook,karmaLook})).catch(error=>{loading=null;throw error;});
}
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

export function attachGunC(rig,items,team,objects) {
  rig.setAppearance?.((team==='evil'?items.evilLook:team==='karma'?items.karmaLook:null)??null);
  const equipment=new Map(),a=new Point(),b=new Point(),pa=new Point(),pb=new Point(),muzzle=new Point(),out=new Point();
  const candidates=items.filter(item=>item.team===team);
  let current=null,targetFacing=null;
  const restoreWings=()=>{
    for(const entry of equipment.values())if(entry.holding){entry.wing.rotation=entry.walkRotation;entry.holding=false;}
  };
  const originalUpdate=rig.update;
  const combatUpdate=originalUpdate?function(dt,options){
    restoreWings();
    return originalUpdate.call(rig,dt,{...options,turn:targetFacing??options.turn,aiming:true});
  }:null;
  if(combatUpdate)rig.update=combatUpdate;
  return {
    update(pose) {
      targetFacing=pose.facing??pose.turn??0;
      for(const entry of equipment.values())entry.mount.visible=false;
      current=null;if(!pose.alive)return;
      const art=rig.root.children.find(child=>child.children?.some(view=>view.label?.startsWith('Direction ')));
      const view=art?.children.find(child=>child.visible&&child.label?.startsWith('Direction '));
      if(!view)return;
      const angle=Number(view.label.slice('Direction '.length));
      const spec=candidates.find(item=>Math.abs(delta(item.rigAngle*Math.PI/180,angle*Math.PI/180))<.001);
      if(!spec)return;
      const body=view.children[2],wing=body?.children.find(child=>child.label===spec.wingPose.part);
      if(!wing)return;
      let entry=equipment.get(view);
      if(!entry){
        const mount=new Container({label:'Gun C wing grip'}),sprite=new Sprite({texture:spec.texture,label:'Gun C pump splatter popper'});
        sprite.position.set(-spec.anchor.x-spec.grip[0],-spec.anchor.y-spec.grip[1]);mount.addChild(sprite);
        entry={mount,wing,index:body.getChildIndex(wing),body,spec};equipment.set(view,entry);
        // The held popper must stay visible above the gripping feather and torso
        // in every view, including views whose normal walking wing is far-side.
        body.addChild(mount);
      }
      const aim=pose.aimFacing??targetFacing;
      a.set(pose.x,pose.y);b.set(pose.x+Math.sin(aim)*100,pose.y+Math.cos(aim)*100);
      objects.toGlobal(a,pa);objects.toGlobal(b,pb);body.toLocal(pa,undefined,a);body.toLocal(pb,undefined,b);
      const barrel=Math.atan2(b.y-a.y,b.x-a.x);
      entry.mount.rotation=barrel-Math.atan2(spec.aimScreenVector[1],spec.aimScreenVector[0]);
      if(!entry.holding){entry.walkRotation=wing.rotation;wing.rotation+=holdingWingTilt(spec);entry.holding=true;}
      // Use the real walking joint transform, including its normal swing and
      // turn interpolation, with the gripping wing raised to carry the popper.
      a.set(spec.wingPose.contactRest[0]-spec.wingPose.pivot[0],spec.wingPose.contactRest[1]-spec.wingPose.pivot[1]);
      wing.toGlobal(a,pa);body.toLocal(pa,undefined,b);
      entry.mount.position.copyFrom(b);
      body.setChildIndex(entry.mount,body.children.length-1);
      entry.mount.visible=true;
      current=entry;
    },
    muzzle() {
      if(!current)return null;
      muzzle.set(current.spec.muzzle[0]-current.spec.grip[0],current.spec.muzzle[1]-current.spec.grip[1]);
      current.mount.toGlobal(muzzle,out);return objects.toLocal(out,undefined,muzzle);
    },
    dispose() {
      restoreWings();
      if(combatUpdate&&rig.update===combatUpdate)rig.update=originalUpdate;
      rig.setAppearance?.(null);
      for(const {mount,wing,index,body} of equipment.values()){
        if(!mount.destroyed){mount.removeFromParent();mount.destroy({children:true});}
        if(!body.destroyed&&wing.parent===body)body.setChildIndex(wing,Math.min(index,body.children.length-1));
      }
      equipment.clear();current=null;
    },
  };
}
