import sites from './karma-sites.json' with {type:'json'};

export const KARMA_ACTIVE=100;
export const KARMA_RADIUS=65;
export const KARMA_PER_ISLAND=15;
export const KARMA_PER_ISLET=3;
export const karmaCap=region=>region.startsWith('sea-')?KARMA_PER_ISLET:KARMA_PER_ISLAND;
export const KARMA_RESPAWN_MIN=30_000;
export const KARMA_RESPAWN_MAX=60_000;
export const KARMA_SITES=sites;

export class KarmaPool {
  constructor(saved=null,random=Math.random){
    this.random=random;this.version=1;
    this.sites=new Map(sites.map(s=>[s.id,s]));
    const valid=saved?.length===KARMA_ACTIVE&&new Set(saved.map(s=>s.id)).size===KARMA_ACTIVE&&new Set(saved.map(s=>s.siteId)).size===KARMA_ACTIVE&&saved.every(s=>this.sites.has(s.siteId)&&Number.isFinite(s.readyAt));
    const counts=new Map();
    if(valid)for(const slot of saved){const region=this.sites.get(slot.siteId).region;counts.set(region,(counts.get(region)??0)+1);}
    if(valid&&[...counts.entries()].every(([region,n])=>n<=karmaCap(region)))this.slots=saved.map(s=>({...s}));
    else{
      const regions=[...new Set(sites.map(s=>s.region))],major=regions.filter(r=>!r.startsWith('sea-'));
      this.slots=[];
      const add=region=>{const site=this.choose(region);this.slots.push({id:`karma-${this.slots.length}`,siteId:site.id,readyAt:0});};
      for(const region of regions)for(let n=0;n<2;n++)add(region);
      for(const region of major)add(region);
      // Fill the rest onto the big islands, round by round in a shuffled order, never past an island's cap.
      const count=region=>this.slots.filter(s=>this.sites.get(s.siteId).region===region).length;
      while(this.slots.length<KARMA_ACTIVE){
        const open=major.filter(r=>count(r)<karmaCap(r));if(!open.length)break;
        for(let n=open.length-1;n>0;n--){const k=Math.floor(this.random()*(n+1));[open[n],open[k]]=[open[k],open[n]];}
        for(const region of open){if(this.slots.length>=KARMA_ACTIVE)break;add(region);}
      }
    }
    this.indexVersion=0;
    this.activeByIsland=new Map();
  }
  choose(region,previous=null){
    const used=new Set(this.slots.map(s=>s.siteId));
    let options=sites.filter(s=>s.region===region&&!used.has(s.id)&&s.id!==previous?.id);
    if(!options.length)options=sites.filter(s=>!used.has(s.id)&&s.id!==previous?.id);
    if(previous){const distant=options.filter(s=>s.islandId!==previous.islandId||Math.hypot(s.x-previous.x,s.y-previous.y)>450);if(distant.length)options=distant;}
    return options[Math.floor(this.random()*options.length)];
  }
  refresh(now){let changed=false;for(const slot of this.slots)if(slot.readyAt>0&&slot.readyAt<=now){slot.readyAt=0;changed=true;}if(changed)this.version++;return changed;}
  activeOn(islandId){
    if(this.indexVersion!==this.version){
      this.activeByIsland.clear();
      for(const slot of this.slots){
        if(slot.readyAt!==0)continue;
        const site=this.sites.get(slot.siteId);
        if(!this.activeByIsland.has(site.islandId))this.activeByIsland.set(site.islandId,[]);
        this.activeByIsland.get(site.islandId).push({slot,site});
      }
      this.indexVersion=this.version;
    }
    return this.activeByIsland.get(islandId);
  }
  visible(islandId){return this.activeOn(islandId)?.map(({slot,site})=>({...site,id:slot.id}))??[];}
  claim(actor,now,canReach=()=>true){
    if(actor.mode!=='walking'||actor.jumpLeft>0)return null;
    const pickup=this.activeOn(actor.islandId)?.find(({site})=>{
      const dx=actor.x-site.x,dy=actor.y-site.y;
      return dx*dx+dy*dy<=KARMA_RADIUS*KARMA_RADIUS&&canReach(site);
    });
    if(!pickup)return null;
    const {slot,site:from}=pickup;
    const counts=new Map();for(const current of this.slots){const region=this.sites.get(current.siteId).region;counts.set(region,(counts.get(region)??0)+1);}
    // Respawn on the landmass that is emptiest for its size (count against its own cap).
    const fill=r=>(counts.get(r)??0)/karmaCap(r);
    const regions=[...new Set(sites.map(s=>s.region))].filter(r=>r!==from.region&&(counts.get(r)??0)<karmaCap(r));
    const minimum=Math.min(...regions.map(fill));
    const choices=regions.filter(r=>fill(r)===minimum);
    const next=this.choose(choices[Math.floor(this.random()*choices.length)],from);
    slot.siteId=next.id;slot.readyAt=now+KARMA_RESPAWN_MIN+Math.floor(this.random()*(KARMA_RESPAWN_MAX-KARMA_RESPAWN_MIN));
    this.version++;
    return {id:slot.id,islandId:from.islandId,x:from.x,y:from.y};
  }
  save(){return this.slots.map(s=>({...s}));}
}
