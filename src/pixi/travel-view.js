import {Assets, Container, Graphics, Sprite, Text} from 'pixi.js';
import {HARBOR, destinationsFor, islandFor, ISLAND_SCALE, offshoreProgress} from './islands.js';
import art from './art-manifest.json';
import shapes from './walk-shapes.json';

function label(text,x,y,size=32) {
  const node=new Text({text,style:{fontFamily:'system-ui, sans-serif',fontSize:size,fontWeight:'600',fill:0x39472d,
    stroke:{color:0xfff0c7,width:5},align:'center'}});
  node.anchor.set(.5,1);
  node.position.set(x,y);
  return node;
}

export async function createTravelView(objects,water,air) {
  const [texture,...tiles]=await Promise.all([Assets.load('/pixi-art/boat-sail.png'),...art.ground.tiles.map(tile=>Assets.load(tile.src))]);
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
  const markers=new Container({label:'Distant islands'});
  water.addChild(markers);
  const clouds=new Container({label:'Offshore clouds'});
  air.addChild(clouds);
  const cloudPuffs=Array.from({length:18},(_,i)=>{
    const puff=new Graphics().ellipse(-70,15,100,35).ellipse(0,0,130,55).ellipse(100,18,100,35).fill({color:0xfff8e9,alpha:.8});
    const x=-500+(i%6)*950+Math.sin(i*17)*280, y=-260-Math.floor(i/6)*470+Math.cos(i*7)*140;
    puff.scale.set(.65+(Math.sin(i*13)+1)*.3);
    puff.position.set(x,y); clouds.addChild(puff);
    return {puff,x,y};
  });
  let destinations=[];
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
      for (const child of markers.removeChildren()) child.destroy({children:true});
      destinations=destinationsFor(id).map(destination=>{
        const root=new Container({label:destination.name}), mini=new Container();
        mini.scale.set(ISLAND_SCALE);
        mini.position.set(destination.x-2900*ISLAND_SCALE,destination.y-2200*ISLAND_SCALE);
        art.ground.tiles.forEach((tile,i)=>{
          const sprite=new Sprite(tiles[i]);
          sprite.position.set(tile.x,tile.y); sprite.width=tile.width; sprite.height=tile.height;
          mini.addChild(sprite);
        });
        const mask=new Graphics().poly(shapes.coast.flat()).fill(0xffffff);
        mini.addChild(mask); mini.mask=mask;
        root.addChild(mini);
        const trees=new Graphics();
        for (const [x,y] of [[-120,-25],[75,-40],[0,-100],[150,35]]) {
          trees.rect(destination.x+x-5,destination.y+y,10,35).fill(0x885931)
            .circle(destination.x+x,destination.y+y-15,35).fill(0x4aa539).stroke({color:0x39472d,width:2});
        }
        const pier=new Graphics().rect(destination.x-55,destination.y+150,110,55).fill(0xc88941).stroke({color:0x39472d,width:3});
        for (let dy=160;dy<205;dy+=12) pier.moveTo(destination.x-53,destination.y+dy).lineTo(destination.x+53,destination.y+dy).stroke({color:0x885931,width:2});
        const flag=new Graphics().moveTo(destination.x+100,destination.y+75).lineTo(destination.x+100,destination.y+135).stroke({color:0x885931,width:5})
          .poly([destination.x+100,destination.y+75,destination.x+160,destination.y+88,destination.x+100,destination.y+100]).fill(destination.accent);
        root.addChild(trees,pier,flag,label(destination.name,destination.x,destination.y-205,38),label('Dock',destination.dock.x,destination.dock.y+65,28));
        markers.addChild(root);
        return {...destination,root};
      });
    },
    update(boats,t,reduced,visible,player) {
      const progress=offshoreProgress(player);
      clouds.alpha=progress*.65;
      for (const cloud of cloudPuffs) {
        cloud.puff.position.set(cloud.x+(reduced?0:Math.sin(t*.08+cloud.x)*35),cloud.y);
        cloud.puff.visible=progress>0 && visible(cloud.x,cloud.y,400);
      }
      for (const destination of destinations) {
        const distance=player?Math.hypot(player.x-destination.x,player.y-destination.y):0;
        destination.root.alpha=Math.min(1,progress*2)*Math.max(0,Math.min(1,(1900-distance)/800));
        destination.root.visible=destination.root.alpha>0 && visible(destination.x,destination.y,600);
      }
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
