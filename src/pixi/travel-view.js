import {Container, Graphics, Sprite, Text} from 'pixi.js';
import {destinationsFor, boatSpots} from './islands.js';
import {createHarbor} from './harbor.js';
import {createSailingFX} from './sailing-fx.js';
import {createSea} from './sea-islands.js';

function label(text,x,y,size=32) {
  const node=new Text({text,style:{fontFamily:'system-ui, sans-serif',fontSize:size,fontWeight:'600',fill:0x39472d,
    stroke:{color:0xfff0c7,width:5},align:'center'}});
  node.anchor.set(.5,1);
  node.position.set(x,y);
  return node;
}

const BORN=.4, BOB_PX=10;
const HOP=.5, DRIFT=.9, DRIFT_PX=36;
const smooth=u => u*u*(3-2*u);
const bobIn=k => k>=1 ? 0 : (1-k)**2*Math.cos(k*Math.PI*1.5);
const driftBy=(heading,d) => ({x:-Math.sin(heading)*d,y:-Math.cos(heading)*d*.45});
const atMooring=boat => boatSpots(boat.islandId).some(spot => spot.x === boat.x && spot.y === boat.y);

export async function createTravelView(objects,water,air,decks) {
  const [sea]=await Promise.all([createSea(water,objects,air)]);
  const harbor=createHarbor(decks,objects);
  const vessels=new Map(), leaving=[], fx=await createSailingFX({water,objects});
  const destroyVessel=entry => {entry.front?.destroy({children:true}); entry.root.destroy({children:true});};
  let disposed=false;
  let settled=false;
  return {
    fx,
    dispose() {
      if (disposed) return;
      disposed=true;
      sea.dispose(); harbor.dispose(); fx.dispose();
      for (const entry of [...vessels.values(), ...leaving]) destroyVessel(entry);
      vessels.clear(); leaving.length=0;
    },
    transient: () => [...[...vessels.values(), ...leaving].flatMap(entry => [entry.root, entry.front]), ...harbor.transient(), ...sea.transient()],
    showJetty: mapId => harbor.show(mapId),
    switchIsland(id,shift) {
      harbor.switchIsland(id);
      settled=false;
      if (shift) {
        fx.shift(shift.x,shift.y,typeof shift==='function'?shift:null);
        for (const entry of [...vessels.values(), ...leaving]) {
          const at=typeof shift==='function'?shift(entry.root):{x:entry.root.x+shift.x,y:entry.root.y+shift.y};
          const dy=at.y-entry.root.y;entry.root.position.set(at.x,at.y);
          const p=typeof shift==='function'?shift({x:entry.x??0,y:entry.y??0}):{x:(entry.x??0)+shift.x,y:(entry.y??0)+shift.y};entry.x=p.x;entry.y=p.y;
          if(entry.leaving)entry.root.zIndex+=dy;
        }
      } else {
        fx.reset();
        for (const entry of leaving.splice(0)) destroyVessel(entry);
      }
      sea.switchIsland(destinationsFor(id));
    },
    update(boats,t,reduced,visible,player,camera) {
      harbor.update(boats,t,reduced);
      sea.update(t,reduced,visible,player,camera);
      const now=performance.now(), ids=new Set(boats.map(boat => boat.id));
      for (const boat of boats) {
        const entry=vessels.get(boat.id);
        if (entry?.occupied && !boat.occupant && Math.hypot(entry.x-boat.x,entry.y-boat.y) > 300) {ids.delete(boat.id); fx.forget(boat.id);}
      }
      for (const [id,entry] of vessels) if (!ids.has(id)) {
        vessels.delete(id);
        if (reduced) {destroyVessel(entry); continue;}
        entry.leaving=now; entry.wait=entry.occupied ? HOP : 0; entry.drift=0; entry.born=0; leaving.push(entry);
      }
      const fresh=boats.filter(boat => !vessels.has(boat.id));
      const arriving=settled && !reduced && fresh.length <= 2;
      for (const boat of fresh) {
        const i=boat.occupant ? -1 : leaving.findIndex(entry => !entry.occupied && now-entry.leaving < 400 &&
          Math.hypot(entry.x-boat.x,entry.y-boat.y) < 12);
        if (i >= 0) {
          const [entry]=leaving.splice(i,1), back=driftBy(entry.heading,entry.drift);
          entry.root.x-=back.x; entry.root.y-=back.y; entry.root.alpha=1; entry.leaving=0; entry.born=0;
          entry.root.label=boat.id; vessels.set(boat.id,entry);
          continue;
        }
        const root=new Container({label:boat.id}), sprite=new Sprite();
        root.addChild(sprite); objects.addChild(root);
        const born=arriving && !boat.occupant && atMooring(boat) ? now : 0;
        if (born) root.alpha=0;
        vessels.set(boat.id,{root,sprite,born});
      }
      for (let i=leaving.length-1;i>=0;i--) {
        const entry=leaving[i], u=Math.max(0,(now-entry.leaving)/1000-entry.wait)/DRIFT;
        if (u>=1) {destroyVessel(entry); leaving.splice(i,1); continue;}
        const e=1-(1-u)**2, was=driftBy(entry.heading,entry.drift), to=driftBy(entry.heading,e*DRIFT_PX);
        entry.root.x+=to.x-was.x; entry.root.y+=to.y-was.y; entry.drift=e*DRIFT_PX;
        entry.root.alpha=1-smooth(u);
      }
      for (const boat of boats) {
        const entry=vessels.get(boat.id);
        entry.root.zIndex=boat.y+2;
        entry.root.visible=visible(boat.x,boat.y,260);
        entry.seat=fx.boat(entry,boat,reduced);
        entry.occupied=Boolean(boat.occupant); entry.heading=boat.turn ?? Math.PI; entry.x=boat.x; entry.y=boat.y;
        if (entry.born) {
          const k=Math.min(1,(now-entry.born)/1000/BORN);
          entry.root.alpha=smooth(Math.min(1,k*1.4));
          entry.root.y+=BOB_PX*bobIn(k);
          if (k>=1) {entry.born=0; entry.root.alpha=1;}
        }
      }
      if (boats.length) settled=true;
      for (const entry of [...vessels.values(), ...leaving]) fx.front(entry);
      fx.draw(reduced);
    },
  };
}
