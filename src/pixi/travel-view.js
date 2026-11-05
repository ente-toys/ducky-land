import {Assets, Container, Graphics, Sprite, Text} from 'pixi.js';
import {HARBOR, destinationsFor, islandFor} from './islands.js';
import {createSea} from './sea-islands.js';

function label(text,x,y,size=32) {
  const node=new Text({text,style:{fontFamily:'system-ui, sans-serif',fontSize:size,fontWeight:'600',fill:0x39472d,
    stroke:{color:0xfff0c7,width:5},align:'center'}});
  node.anchor.set(.5,1);
  node.position.set(x,y);
  return node;
}

export async function createTravelView(objects,water,air) {
  const [texture,sea]=await Promise.all([Assets.load('/pixi-art/boat-sail.png'),createSea(water,objects,air)]);   // boss 5 Nov: the cloud bank and sea islands live in sea-islands.js
  const harbor=new Container({label:'Island harbor'});
  harbor.zIndex=HARBOR.land.y-1;
  const {x,y,width,height}=HARBOR.pier;
  const pier=new Graphics().rect(x,y,width,height).fill(0xc88941).stroke({color:0x39472d,width:5});
  for (let y=765;y<950;y+=25) pier.moveTo(1738,y).lineTo(1862,y).stroke({color:0x885931,width:3});
  harbor.addChild(pier);
  const flag=new Graphics(),flowers=new Graphics();
  harbor.addChild(flag,flowers);
  const sign=label('',1600,965,34);
  sign.zIndex=5000;
  objects.addChild(sign);
  objects.addChild(harbor);
  const vessels=new Map();
  return {
    switchIsland(id) {
      const island=islandFor(id);
      sign.text=`${island.name}\nHarbor`;
      flag.clear().moveTo(1910,945).lineTo(1910,790).stroke({color:0x885931,width:7})
        .poly([1910,790,2010,810,1910,835]).fill(island.accent).stroke({color:0x39472d,width:3});
      flowers.clear();
      if (id !== 'home') for (const [x,y] of [[1640,1010],[1675,1030],[1950,1010],[1985,990]]) {
        for (let i=0;i<5;i++) flowers.circle(x+Math.cos(i*Math.PI*.4)*10,y+Math.sin(i*Math.PI*.4)*10,8).fill(island.accent);
        flowers.circle(x,y,5).fill(0xfff0c7);
      }
      sea.switchIsland(destinationsFor(id));
    },
    update(boats,t,reduced,visible,player,camera) {
      sea.update(t,reduced,visible,player,camera);
      const ids=new Set(boats.map(boat => boat.id));
      for (const [id,entry] of vessels) if (!ids.has(id)) {
        entry.root.destroy({children:true}); entry.wake.destroy(); vessels.delete(id);
      }
      for (const boat of boats) {
        let entry=vessels.get(boat.id);
        if (!entry) {
          const root=new Container({label:boat.id}), sprite=new Sprite(texture);
          sprite.anchor.set(.5,.82);
          sprite.width=170; sprite.height=170*texture.height/texture.width;
          root.addChild(sprite);
          const wake=new Graphics();
          water.addChild(wake); objects.addChild(root);
          entry={root,sprite,wake}; vessels.set(boat.id,entry);
        }
        const {root,sprite,wake}=entry;
        root.position.set(boat.x,boat.y+(reduced?0:Math.sin(t*1.4)*2));
        root.zIndex=boat.y+2;
        root.visible=visible(boat.x,boat.y,200);
        sprite.scale.x=Math.abs(sprite.scale.x)*(boat.occupant && Math.sin(boat.turn)<-.1?-1:1);
        sprite.rotation=reduced?0:Math.sin(t*1.1)*.025;
        wake.clear();
        if (boat.occupant && boat.travel>1 && !reduced && root.visible) {
          const dx=Math.sin(boat.turn),dy=Math.cos(boat.turn);
          for (let i=0;i<3;i++) {
            const x=boat.x-dx*(70+i*25),y=boat.y-dy*(70+i*25),w=15+i*8;
            wake.moveTo(x-dy*w,y+dx*w).quadraticCurveTo(x-dx*15,y-dy*15,x+dy*w,y-dx*w)
              .stroke({color:0xfff0c7,width:3,alpha:.6-i*.15});
          }
        }
      }
    },
  };
}
