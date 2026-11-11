import {Assets,Container,Graphics,Sprite,Texture} from 'pixi.js';
import {RULES} from './rules.js';

const EMPTY=Object.freeze([]);
let loading;
export function loadPickupArt(){
  // Direct Node consumers do not have Vite's asset transform.
  if(!import.meta.env?.BASE_URL)return Promise.resolve({});
  const urls=import.meta.glob('./assets/pickups/*.svg',{query:'?url',import:'default',eager:true});
  return loading??=Promise.all(['paint','speed','shield'].map(async kind=>[kind,await Assets.load(urls[`./assets/pickups/${kind}.svg`])]))
    .then(Object.fromEntries).catch(error=>{loading=null;throw error;});
}
const colours={paint:0x08c225,speed:0xffd94f,shield:0x7ab9ff};
// Five stable nodes, built once. Frame updates only change transforms/visibility.
export function createPickupsView(objects,art,{tilt=1}={}){
  const nodes=new Map();
  return {update(snapshot,time,reduced=false){
    for(const spot of snapshot.pickups??EMPTY){
      let node=nodes.get(spot.id);
      if(!node){
        const root=new Container({label:`Bog ${spot.kind} pickup`}),ring=new Graphics(),icon=new Sprite(art[spot.kind]??Texture.EMPTY);
        root.upright=true;ring.ellipse(0,0,42,27).fill({color:colours[spot.kind],alpha:.12}).stroke({color:colours[spot.kind],alpha:.5,width:2});
        icon.anchor.set(.5,1);icon.width=64;icon.height=64;icon.scale.y/=tilt;
        root.addChild(ring,icon);objects.addChild(root);node={root,ring,icon};nodes.set(spot.id,node);
      }
      node.root.visible=spot.readyAt<=time;
      node.root.position.set(spot.x,spot.y);node.root.zIndex=spot.y+.05;
      const bob=reduced?0:Math.sin(time*2+spot.x*.01)*3;
      node.icon.y=(-14-bob)/tilt;node.ring.alpha=reduced?.8:.75+Math.sin(time*2)*.15;
    }
  },dispose(){for(const {root}of nodes.values()){root.removeFromParent();root.destroy({children:true});}nodes.clear();}};
}

export function createAbilityView(objects,rig,{tilt=1}={}){
  const bubble=new Graphics();bubble.upright=true;
  bubble.ellipse(0,0,43,58).fill({color:0xc3ecff,alpha:.12}).stroke({color:0x7ab9ff,alpha:.65,width:2.5})
    .arc(0,0,33,Math.PI*1.07,Math.PI*1.45).stroke({color:0xffffff,alpha:.75,width:3});
  bubble.scale.y=1/tilt;objects.addChild(bubble);
  let art;
  return {update(p,time,reduced=false){
    // The island resets its rig transform before every combat render pass.
    const left=Math.max(0,(p.dodgeUntil??0)-time);
    if(p.alive&&left>0&&!reduced){
      const u=1-Math.min(1,left/RULES.dodgeSeconds),lift=Math.sin(Math.PI*u);
      if(!art)for(const child of rig.root.children){for(const view of child.children??EMPTY){if(view.label?.startsWith('Direction ')){art=child;break;}}if(art)break;}
      if(art){const squash=u<.18?-.07*Math.sin(u/.18*Math.PI):.08*lift;art.scale.x*=1-squash;art.scale.y*=1+squash;}
      rig.root.y-=12*lift/tilt;
    }
    bubble.visible=rig.root.visible&&p.alive&&p.hitShield>0&&p.hitShieldUntil>time;
    bubble.position.set(rig.root.x,rig.root.y-57/tilt);bubble.zIndex=rig.root.zIndex+.3;
  },dispose(){bubble.removeFromParent();bubble.destroy();}};
}
