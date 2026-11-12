import {KarmaPool} from '../src/gameplay/karma-pool.js';

export class RoomKarma {
  constructor(room){
    this.room=room;this.balances=new Map();this.bogEntries=new Map();
    room.sql.exec('CREATE TABLE IF NOT EXISTS karma_balances (account TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0)); CREATE TABLE IF NOT EXISTS karma_world (id INTEGER PRIMARY KEY, state TEXT NOT NULL)');
    room.sql.exec('CREATE TABLE IF NOT EXISTS bog_entries (account TEXT PRIMARY KEY, state TEXT NOT NULL)');
    const row=room.sql.exec('SELECT state FROM karma_world WHERE id=1').toArray()[0];
    let saved;try{saved=row?JSON.parse(row.state):null;}catch{saved=null;}
    this.pool=new KarmaPool(saved);
    if(!row||JSON.stringify(saved)!==JSON.stringify(this.pool.save()))this.persist();
  }
  balance(account){
    if(!account)return 0;
    if(!this.balances.has(account))this.balances.set(account,this.room.sql.exec('SELECT balance FROM karma_balances WHERE account=?',account).toArray()[0]?.balance??0);
    return this.balances.get(account);
  }
  bogEntry(account){
    if(!this.bogEntries.has(account)){
      const row=this.room.sql.exec('SELECT state FROM bog_entries WHERE account=?',account).toArray()[0];
      this.bogEntries.set(account,row?JSON.parse(row.state):null);
    }
    return this.bogEntries.get(account);
  }
  beginBogEntry(account,cost=5){
    const current=this.bogEntry(account);if(current)return current;
    const balance=this.balance(account);if(balance<cost)return null;
    const entry={id:crypto.randomUUID(),lives:5,combat:null};
    const save=()=>{
      this.room.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',account,balance-cost);
      this.room.sql.exec('INSERT OR REPLACE INTO bog_entries VALUES(?,?)',account,JSON.stringify(entry));
    };
    if(this.room.ctx.storage.transactionSync)this.room.ctx.storage.transactionSync(save);else save();
    this.balances.set(account,balance-cost);this.bogEntries.set(account,entry);return entry;
  }
  saveBogEntry(account,entry){
    if(this.bogEntry(account)?.id!==entry.id)return;
    this.room.sql.exec('INSERT OR REPLACE INTO bog_entries VALUES(?,?)',account,JSON.stringify(entry));
    this.bogEntries.set(account,entry);
  }
  endBogEntry(account){
    this.room.sql.exec('DELETE FROM bog_entries WHERE account=?',account);this.bogEntries.set(account,null);
  }
  persist(){this.room.sql.exec('INSERT OR REPLACE INTO karma_world VALUES(1,?)',JSON.stringify(this.pool.save()));}
  update(now){
    const room=this.room;
    if(![...room.connections.values()].some(info=>info.actor))return;
    let needsPersist=this.pool.refresh(now);
    for(const info of room.connections.values()){
      const actor=info.actor;if(!actor||!info.account||info.expires<=now)continue;
      actor.karma=this.balance(info.account);
      const pickup=this.pool.claim(actor,now,site=>room.navFor(actor.islandId).clearLine([actor.x,actor.y],[site.x,site.y]));
      if(!pickup)continue;
      const total=actor.karma+1;
      const save=()=>{room.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',info.account,total);this.persist();};
      if(room.ctx.storage.transactionSync)room.ctx.storage.transactionSync(save);else save();
      this.balances.set(info.account,total);actor.karma=total;needsPersist=false;
      for(const [socket,viewer]of room.connections)if((viewer.actor?.islandId??viewer.islandId??'home')===actor.islandId){
        room.send(socket,{type:'karma-pickup',...pickup,playerId:actor.id,total});
      }
    }
    if(needsPersist)this.persist();
  }
  broadcast(now){
    const shared=new Map();
    for(const [socket,info]of this.room.connections){
      const islandId=info.actor?.islandId??info.islandId??'home',balance=info.account&&info.expires>now?this.balance(info.account):0;
      const key=`${this.room.epoch}:${this.pool.version}:${islandId}:${balance}`;
      if(info.karmaKey===key)continue;
      info.karmaKey=key;
      if(!shared.has(islandId))shared.set(islandId,this.pool.visible(islandId));
      this.room.send(socket,{type:'karma-state',islandId,balance,feathers:shared.get(islandId)});
    }
  }
}
