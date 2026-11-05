import {Assets, Container, Graphics, Sprite, Text} from 'pixi.js';
import {destinationsFor} from './islands.js';
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

export async function createTravelView(objects,water,air,decks) {
  const [texture,sea]=await Promise.all([Assets.load('/pixi-art/boat-sail.png'),createSea(water,objects,air)]);   // boss 5 Nov: the cloud bank and sea islands live in sea-islands.js
  const harbor=createHarbor(decks,objects);   // boss 5 Nov: a real jetty, signpost and flag (harbor.js)
  const vessels=new Map(), fx=await createSailingFX({water,objects});
  return {
    fx,
    switchIsland(id) {
      harbor.switchIsland(id);
      fx.reset();
      sea.switchIsland(destinationsFor(id));
    },
    update(boats,t,reduced,visible,player,camera) {
      harbor.update(boats,t,reduced);
      sea.update(t,reduced,visible,player,camera);
      const ids=new Set(boats.map(boat => boat.id));
      for (const [id,entry] of vessels) if (!ids.has(id)) {
        entry.root.destroy({children:true}); vessels.delete(id);
      }
      for (const boat of boats) {
        let entry=vessels.get(boat.id);
        if (!entry) {
          const root=new Container({label:boat.id}), sprite=new Sprite(texture);
          sprite.anchor.set(.5,.82);
          sprite.width=170; sprite.height=170*texture.height/texture.width;
          root.addChild(sprite); objects.addChild(root);
          entry={root,sprite}; vessels.set(boat.id,entry);
        }
        // boss 5 Nov: heading, heel, bob, dip, rock and the foam wake live in sailing-fx.js
        entry.root.zIndex=boat.y+2;
        entry.root.visible=visible(boat.x,boat.y,260);
        entry.seat=fx.boat(entry,boat,reduced);
      }
      fx.draw(reduced);
    },
  };
}
