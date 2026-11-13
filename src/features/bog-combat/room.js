import {ArenaClient} from './client.js';
import {BOG_ISLAND} from './entry.js';
import {movementFacing} from './facing.js';

export class BogCombatRoom {
  constructor({islandId=BOG_ISLAND,onSnapshot=()=>{},onStatus=()=>{},...options}={}) {
    this.islandId=islandId;this.mode='walking';this.boats=[];this.alpha=1;this.fire=false;this.facing=0;
    this.client=new ArenaClient({...options,onStatus,onSnapshot:snapshot=>{
      const self=snapshot.players.find(p=>p.id===this.client.id);
      if(self)this.facing=self.facing??this.facing;
      onSnapshot(snapshot,self);
    }});
  }
  get id(){return this.client.id;}
  get tick(){return this.client.snapshot?.tick??-1;}
  get player(){return this.client.predicted;}
  get totals(){const p=this.client.self;return p?{stats:{...p.stats},medalCase:{...p.medalCase}}:null;}
  navHere(){return this.client.nav;}
  setAlpha(alpha){this.alpha=Math.max(0,Math.min(1,alpha));}
  dodge(){this.client.queueDodge();}
  setFire(fire){this.fire=!!fire;}
  step(dt,input,now=performance.now()) {
    const living=this.client.self?.alive;
    const vector=living?input:{x:0,y:0,run:false};
    this.facing=movementFacing(vector,this.facing);
    this.client.control(vector,this.facing,living&&this.fire,dt,now,this.queuedEmote);
    this.queuedEmote=null;
  }
  view(){return this.client.view(this.alpha);}
  poses(now=performance.now()/1000) {
    const snapshot=this.client.snapshot;if(!snapshot)return [];
    return snapshot.players.map(p=>({
      ...(p.id===this.id?this.view():this.client.sample(p.id,now*1000)),
      id:p.id,player:p.id===this.id,mode:'walking',islandId:this.islandId,outfit:{},
    }));
  }
  emote(action){if(!this.player?.alive||!Number.isInteger(action)||action<2||action>9)return false;this.queuedEmote=action;return true;}
  stopInput(){
    this.fire=false;this.queuedEmote=null;
    if(this.player)Object.assign(this.player,{path:[],heading:null,pace:0,travel:0});
    this.client.control({x:0,y:0,run:false},this.facing,false,0);
  }
  boatPoses(){return [];}
  destination(){return null;}
  jump(){return false;}
  board(){return false;}
  disembark(){return false;}
  chat(){}
  dispose(){this.stopInput();this.client.dispose();}
}
