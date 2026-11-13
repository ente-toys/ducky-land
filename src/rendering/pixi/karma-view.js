import {Assets,Container,Graphics,Sprite,Text,Point,Texture,ColorMatrixFilter} from 'pixi.js';
import {ART_TEXTURE} from './art/art-texture.js';
import {mapPoint} from '../../world/sphere-coordinates.js';
import {TILT} from '../shared/camera.js';
import {artOf} from '../../world/island-maps.js';

export async function createKarmaView(game){
  const texture=await Assets.load({src:'/pixi-art/karma/golden-feather.svg',data:ART_TEXTURE});
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
  const gc=glowCanvas.getContext('2d'),gradient=gc.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,255,212,.95)');gradient.addColorStop(.25,'rgba(255,232,104,.75)');gradient.addColorStop(.58,'rgba(255,191,45,.28)');gradient.addColorStop(1,'rgba(255,176,35,0)');gc.fillStyle=gradient;gc.fillRect(0,0,128,128);
  const glowTexture=Texture.from(glowCanvas);
  const preview=location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).has('qa');
  const previewFilter=new ColorMatrixFilter(),hues={gold:0,mint:90,sky:155,lilac:235,rose:290};
  let palette='gold';
  const spots=new Map(),flights=[],host=game.host;
  const counter=document.createElement('div');counter.className='pixi-karma-counter';counter.setAttribute('role','status');counter.setAttribute('aria-live','polite');
  counter.innerHTML='<img src="/pixi-art/karma/golden-feather.svg" alt=""><span>0</span>';
  Object.assign(counter.style,{position:'absolute',left:'20px',top:'88px',zIndex:'5',display:'flex',alignItems:'center',gap:'8px',padding:'8px 13px',border:'2px solid #8b754b',borderRadius:'20px',background:'#fff4d6',color:'#403625',font:'700 17px system-ui',pointerEvents:'none',boxShadow:'0 3px 0 #0002'});
  Object.assign(counter.querySelector('img').style,{width:'27px',height:'27px'});host.append(counter);
  let count=-1,disposed=false;
  const prior=game.room.onKarmaPickup;
  const pickup=event=>{
    prior(event);
    if(game.disposed||disposed)return;
    const sprite=new Sprite(texture);sprite.anchor.set(.5);sprite.width=sprite.height=50;sprite.upright=true;game.objects.addChild(sprite);
    const text=new Container({label:'Golden feather reward'});text.upright=true;
    const badge=new Graphics().roundRect(-43,-19,86,38,19).fill(0xfff4d6).stroke({color:0xb58131,width:2});
    const icon=new Sprite(texture);icon.anchor.set(.5);icon.width=icon.height=29;icon.position.set(-22,-1);
    const amount=new Text({text:'+1',style:{fontFamily:'system-ui',fontSize:24,fontWeight:'800',fill:0x765025}});amount.anchor.set(.5);amount.x=13;
    text.addChild(badge,icon,amount);game.objects.addChild(text);
    const spark=new Graphics();spark.upright=true;game.objects.addChild(spark);
    flights.push({event,sprite,text,spark,age:0});
    if(event.playerId===game.room.id)game.audio.play('pop',.1);
  };
  game.room.onKarmaPickup=pickup;
  const remove=item=>{item.sprite.destroy();item.text.destroy({children:true});item.spark.destroy();};
  return {
    update(dt,time,reduced,visible){
      const nextPalette=preview?(document.documentElement.dataset.karmaColor??'gold'):'gold';
      if(nextPalette!==palette&&Object.hasOwn(hues,nextPalette)){palette=nextPalette;previewFilter.reset();previewFilter.hue(hues[palette],false);}
      const room=game.room,balance=room.karma??0;counter.style.display=room.player?'flex':'none';
      if(count!==balance){count=balance;counter.querySelector('span').textContent=String(balance);counter.dataset.karma=String(balance);if(!reduced)counter.animate([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:260});}
      const wanted=new Set();
      for(const feather of room.featherIsland===game.islandId&&game.artShown===artOf(game.islandId)?room.feathers:[]){
        wanted.add(feather.id);let item=spots.get(feather.id);
        if(!item){
          const root=new Container({label:'Golden Karma feather'});root.upright=true;
          const shadow=new Graphics().ellipse(0,0,26,9).fill({color:0xffe26d,alpha:.12});
          const halo=new Sprite(glowTexture);halo.anchor.set(.5);halo.width=halo.height=124;halo.blendMode='add';
          const sprite=new Sprite(texture);sprite.anchor.set(.5);sprite.width=sprite.height=56;
          const gleam=new Sprite(texture);gleam.anchor.set(.5);gleam.width=gleam.height=56;gleam.tint=0xffedb1;gleam.blendMode='add';
          const sweep=new Graphics(),clip=new Sprite(texture);clip.anchor.set(.5);clip.width=clip.height=56;sweep.mask=clip;sweep.blendMode='add';
          const shine=new Graphics();root.addChild(shadow,halo,sprite,gleam,clip,sweep,shine);game.objects.addChild(root);item={root,sprite,gleam,halo,shadow,shine,sweep,clip,feather};spots.set(feather.id,item);
        }
        item.root.position.set(feather.x,feather.y);item.root.zIndex=feather.y;item.root.visible=visible(feather.x,feather.y,90);
        item.root.filters=palette==='gold'?null:[previewFilter];
        if(!item.root.visible)continue;
        const phase=Number(feather.id.split('-').at(-1))*.73,bob=reduced?0:Math.sin(time*2+phase)*5,pulse=reduced?.5:.5+.5*Math.sin(time*2.2+phase);
        item.sprite.y=(-42+bob)/TILT;item.sprite.rotation=reduced?0:Math.sin(time*1.3+phase)*.09;
        item.gleam.position.copyFrom(item.sprite.position);item.gleam.rotation=item.sprite.rotation;item.gleam.alpha=.05+pulse*.07;
        item.clip.position.copyFrom(item.sprite.position);item.clip.rotation=item.sprite.rotation;
        item.sweep.position.copyFrom(item.sprite.position);item.sweep.rotation=item.sprite.rotation;item.sweep.clear();
        if(!reduced){const cycle=(time*.45+phase)%1,offset=-70+cycle*140;item.sweep.poly([-50,offset-35,50,offset+15,50,offset+26,-50,offset-24]).fill({color:0xfffce3,alpha:Math.sin(cycle*Math.PI)*.32});}
        item.halo.y=item.sprite.y;item.halo.alpha=.16+pulse*.06;item.halo.width=item.halo.height=78+pulse*7;item.shadow.alpha=.5+pulse*.2;
        item.shine.clear();
        for(let n=0;n<2;n++){
          const angle=n*2.399+(reduced?0:time*.32)+phase,fade=reduced?.3:.12+.45*Math.pow(Math.max(0,Math.sin(time*3.5+phase+n*2)),3);
          const x=Math.cos(angle)*(27+n*3),y=item.sprite.y+Math.sin(angle)*(30+n*4)/TILT,r=(n===0?3.2:2.2)*(.7+fade*.3);
          item.shine.moveTo(x,y-r*1.7).quadraticCurveTo(x+r*.35,y-r*.3,x+r,y).quadraticCurveTo(x+r*.3,y+r*.2,x,y+r*1.7).quadraticCurveTo(x-r*.3,y+r*.2,x-r,y).quadraticCurveTo(x-r*.35,y-r*.3,x,y-r*1.7).fill({color:0xfffde0,alpha:fade});
        }
      }
      for(const [id,item]of spots)if(!wanted.has(id)){item.root.destroy({children:true});spots.delete(id);}
      for(let i=flights.length-1;i>=0;i--){
        const f=flights[i];f.age+=dt;const u=Math.min(1,f.age/.6),e=1-(1-u)**3;
        if(f.event.islandId!==game.islandId||f.age>1.5){remove(f);flights.splice(i,1);continue;}
        const entry=game.liveRigs.get(f.event.playerId),rig=entry?.rig;
        const from=mapPoint(f.event.islandId,game.islandId,f.event);
        let target={x:from.x,y:from.y-90};
        if(rig){const point=rig.root.toGlobal(new Point(rig.karmaTarget().x,rig.karmaTarget().y));target=game.objects.toLocal(point);}
        f.sprite.position.set(from.x+(target.x-from.x)*e,from.y-35+(target.y-from.y+35)*e-(reduced?0:Math.sin(u*Math.PI)*80));
        const size=50*(1-.85*e);f.sprite.width=f.sprite.height=size;f.sprite.alpha=1-u;f.sprite.rotation=reduced?0:e*.9;f.sprite.zIndex=1e8;
        const rewardAge=f.age-.4,appear=Math.min(1,Math.max(0,rewardAge/.18)),fade=Math.min(1,Math.max(0,(1.5-f.age)/.3));
        const pop=reduced?1:1+.12*Math.exp(-Math.max(0,rewardAge)*8)*Math.sin(Math.max(0,rewardAge)*22);
        f.text.position.set(target.x,target.y-42-(reduced?0:Math.max(0,rewardAge)*28));
        f.text.scale.set((.88+.12*(1-(1-appear)**3))*pop);
        f.text.alpha=f.event.playerId===room.id?appear*fade:0;f.text.zIndex=1e8;
        f.spark.clear();
        const burstAge=(f.age-.45)/.45,burst=burstAge>=0&&burstAge<1?1-burstAge:0;
        if(burst>0)for(let n=0;n<6;n++){
          const a=n*Math.PI/3-.5,r=reduced?15:10+burstAge*30;
          const x=target.x+Math.cos(a)*r,y=target.y+Math.sin(a)*r/TILT,s=(n%2?2:4)*burst;
          f.spark.poly([x,y-s*1.6,x+s*.32,y-s*.32,x+s,y,x+s*.32,y+s*.32,x,y+s*1.6,x-s*.32,y+s*.32,x-s,y,x-s*.32,y-s*.32]).fill({color:n%2?0xffcf5c:0xfff8d5,alpha:burst});
        }
        f.spark.zIndex=1e8;
      }
    },
    destroy(){disposed=true;if(game.room.onKarmaPickup===pickup)game.room.onKarmaPickup=prior;counter.remove();for(const item of spots.values())item.root.destroy({children:true});for(const f of flights)remove(f);spots.clear();flights.length=0;glowTexture.destroy(true);previewFilter.destroy();},
  };
}
