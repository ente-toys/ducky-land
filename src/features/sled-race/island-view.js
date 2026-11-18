// The sled hill island drawn into the snow island's scene, and the race on it as everyone on its plaza sees it: each
// racer's Ducky in its tube slides down the hill's run where the race has it, with its hops and wipeouts. The racers
// themselves play in the race scene.
import {Assets,Container,Graphics,Sprite,Text} from 'pixi.js';
import {SLED_ART} from './view.js';
import {buildCourse,laneX} from './course.js';
import {SLED_HILL,racerOnHill,runPoint,runWidth} from './hill.js';
import {SLED,TUBE_COLOURS} from './rules.js';
import {RIDERS,dressRider,loadWardrobe,riderFor} from './outfit.js';
import {ART_TEXTURE} from '../../rendering/pixi/art/art-texture.js';
import {TILT} from '../../rendering/shared/camera.js';

const ART='/pixi-art/sled-race/hill-island/';
// a tube is this many lanes wide where it is on the run
const TUBE_LANES=1.25;
// spectators see the race this far behind the server, eased between its updates, so the racers glide
const WATCH_DELAY=.5;
// the art's SVGs are drawn at their world size times this
const SHARPNESS=1.5;
// ground tiles load when they come this close to the screen and are let go once well away from it
const NEAR=700,FAR=2200;

// The hill island's art: the ground (the hill and everything out of reach) in tiles streamed in near the camera, and
// the plaza's props standing among the ducks, each sorted by its feet. `game` is the island scene (objects, camera).
export async function createHillIslandArt(game){
  const objects=game.objects,tiles=new Map(),load=src=>Assets.load({src:ART+src,data:{...ART_TEXTURE,resolution:SHARPNESS}});
  const props=await Promise.all(SLED_HILL.props.map(p=>load(p.src)));
  if(objects.destroyed)return {destroy(){}};
  const sprites=SLED_HILL.props.map((p,i)=>{
    const s=new Sprite(props[i]);s.label=`Sled hill ${p.name}`;s.position.set(p.x,p.y);s.width=p.width;s.height=p.height;s.zIndex=p.z;
    objects.addChild(s);return s;
  });
  function stream(){
    const c=game.camera;if(!c||!game.width)return;
    const hw=game.width/2/c.zoom,hh=game.height/2/(c.zoom*TILT);
    for(const t of SLED_HILL.ground){
      const gap=Math.max(t.x-(c.x+hw),c.x-hw-(t.x+t.width),t.y-(c.y+hh),c.y-hh-(t.y+t.height),0);
      const have=tiles.get(t.src);
      if(gap<NEAR&&!have){
        const entry={sprite:null};tiles.set(t.src,entry);
        load(t.src).then(texture=>{
          if(tiles.get(t.src)!==entry){Assets.unload(ART+t.src);return;}
          const s=new Sprite(texture);s.label='Sled hill ground';s.position.set(t.x,t.y);s.width=t.width;s.height=t.height;s.zIndex=-1e7;
          entry.sprite=s;objects.addChild(s);
        }).catch(error=>{tiles.delete(t.src);console.error('Could not load the sled hill',error);});
      }else if(gap>FAR&&have){tiles.delete(t.src);if(have.sprite){have.sprite.destroy();Assets.unload(ART+t.src);}}
    }
  }
  stream();
  const timer=setInterval(stream,300);
  return {destroy(){
    clearInterval(timer);
    for(const s of sprites)s.destroy();
    for(const [src,t] of tiles)if(t.sprite){t.sprite.destroy();Assets.unload(ART+src);}
    tiles.clear();
  }};
}

export async function createSledIslandView(objects){
  // only the riders: the race scene's other art is not needed to watch from the island
  const riderArt=Object.values(RIDERS).flatMap(({art})=>TUBE_COLOURS.map((c,i)=>SLED_ART[`${art}${i}`]));
  const [wardrobe]=await Promise.all([loadWardrobe(),...riderArt.map(src=>Assets.load({src,data:{...ART_TEXTURE,resolution:2}}))]);
  const tex=key=>Assets.get(SLED_ART[key]);
  const riders=new Map();
  let seed=null,course=null,building=null,focus=null,seen=null,frames=[],offset=Infinity;

  async function build(racers){
    for(const v of riders.values())v.root.destroy({children:true});
    riders.clear();
    await Promise.all(racers.map(async(r,i)=>{
      const root=new Container({label:`Sled racer ${r.name}`,eventMode:'none'}),shadow=new Graphics().ellipse(0,0,46,16).fill({color:0x6f8aa3,alpha:.28});
      const look=riderFor(r.outfit,wardrobe.entries),body=new Sprite(tex(`${look.art}${(r.colour??i)%TUBE_COLOURS.length}`));
      const rider=new Container();rider.addChild(body,await dressRider(r.outfit,look,wardrobe));
      rider.pivot.set(body.texture.width/2,body.texture.height*look.ground);
      const label=new Text({text:r.name,style:{fontFamily:'system-ui',fontSize:22,fontWeight:'700',fill:0x564537}});label.anchor.set(.5);
      const tag=new Container();tag.addChild(new Graphics().roundRect(-label.width/2-10,-16,label.width+20,32,16).fill(0xfff9df).stroke({color:0x564537,width:1.5}),label);
      const ride=new Container();ride.addChild(rider);
      root.addChild(shadow,ride,tag);root.visible=false;objects.addChild(root);
      riders.set(r.id,{root,ride,rider,tag,body,shadow});
    }));
  }

  // the race WATCH_DELAY seconds ago, between the two updates either side of that moment
  function racersAt(now){
    const t=now-offset-WATCH_DELAY;
    let i=frames.findIndex(f=>f.time>t);
    if(i<0)i=frames.length-1;
    const b=frames[i],a=frames[Math.max(0,i-1)],u=b.time>a.time?Math.min(1,Math.max(0,(t-a.time)/(b.time-a.time))):1;
    const before=new Map(a.state.map(r=>[r.id,r]));
    return {time:Math.max(a.time,Math.min(b.time,t)),racers:b.state.map(r=>{const p=before.get(r.id)??r;return {...r,d:p.d+(r.d-p.d)*u,x:p.x+(r.x-p.x)*u};})};
  }

  // lobby: the hill room's last message (phase, seed, racers and, during a race, its state)
  function update(lobby){
    const now=performance.now();
    const live=lobby&&(lobby.phase==='countdown'||lobby.phase==='racing')&&lobby.racers?.length;
    if(!live){for(const v of riders.values())v.root.visible=false;focus=null;frames=[];return;}
    if(lobby.seed!==seed&&!building){
      seed=lobby.seed;course=buildCourse(seed);frames=[];offset=Infinity;
      building=build(lobby.racers).finally(()=>{building=null;});
    }
    if(lobby!==seen&&lobby.phase==='racing'&&lobby.state){
      seen=lobby;frames.push({time:lobby.time,state:lobby.state});
      offset=Math.min(offset,now/1000-lobby.time);
      while(frames.length>2&&frames[1].time<lobby.time-WATCH_DELAY-1)frames.shift();
    }
    if(building||!course)return;
    const counting=lobby.phase==='countdown'||!frames.length,race=counting?null:racersAt(now/1000);
    const leader=race?.racers.filter(r=>!r.left).sort((a,b)=>b.d-a.d)[0];
    // the camera for anyone watching follows the leader down the hill (the start during the countdown)
    focus=leader?racerOnHill(leader,course):runPoint(0,.5);
    for(const [id,v] of riders){
      const r=race?race.racers.find(x=>x.id===id):lobby.racers.find(x=>x.id===id);
      // a racer who has left the race goes back to the island
      v.root.visible=Boolean(r&&!r.left);if(!v.root.visible)continue;
      // before the race: on the start line one to a lane, in the order the race starts them
      const lane=Math.min(SLED.lanes-1,Math.max(0,Math.floor((SLED.lanes-lobby.racers.length)/2))+lobby.racers.findIndex(x=>x.id===id));
      const at=race?racerOnHill(r,course):{...runPoint(0,laneX(lane)/SLED.trackWidth+.5),u:0};
      const laneWide=runWidth(at.u)/SLED.lanes,scale=laneWide*TUBE_LANES/v.body.texture.width,time=race?.time??0;
      const air=race&&time<r.airUntil,crashed=race&&time<r.crashUntil;
      const hop=air?Math.sin(Math.PI*(1-(r.airUntil-time)/SLED.jumpSeconds))*laneWide*.9:0;
      v.root.position.set(at.x,at.y);v.root.zIndex=at.y+.5;
      v.rider.scale.set(scale);v.ride.y=-hop;v.shadow.scale.set(scale*(air?.7:1));
      v.ride.rotation=crashed?Math.sin(time*18)*.3:0;
      v.rider.alpha=crashed&&Math.floor(time*8)%2===1?.4:1;
      v.tag.y=-v.body.texture.height*scale*.95-hop;
    }
  }
  function destroy(){for(const v of riders.values())v.root.destroy({children:true});riders.clear();}
  return {update,destroy,focus:()=>focus};
}
