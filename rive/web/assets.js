// Native Rive artboards converted from the asset session's SVG manifest.
export async function installAssets(game){
 const library=await fetch('asset-library.json').then(r=>r.json());
 const byName=new Map(library.map(a=>[a.name,a]));const loaded=new Map();
 function art(asset){if(!loaded.has(asset.artboard)){const a=game.file.artboardByName(asset.artboard);a.frameOrigin=false;a.advance(0);loaded.set(asset.artboard,a);}return loaded.get(asset.artboard);}
 const replacements={'Drip tree':'tree-oak','Hill tree':'tree-round','Plaza bench':'bench-wood','Race bench':'bench-park','Plaza lantern':'lamp-lantern','Plaza planter':'planter-flowers','Beach shell':'shell-scallop','Coast rock':'rock-boulder','Racing sailboat':'sailboat','Blue racing sailboat':'rowboat','Beach umbrella':'umbrella-garden','Beach blanket':'picnic-blanket','Outdoor reading':'picnic-table'};
 let replaced=0;
 for(const prop of game.props){const asset=byName.get(replacements[prop.name]);if(!asset)continue;prop.art=art(asset);prop.scale=.24;prop.asset=asset.name;replaced++;}
 // Scatter small authored details in the seven zones. Large buildings, floor
 // tiles and UI symbols remain a reusable native library instead of clutter.
 const objects=[],zones=['bread-forest','pond','library','plaza','race-lake','lighthouse-beach','islets'];
 const available=library.filter(a=>['food','nature','beach','street'].includes(a.category)&&!a.name.startsWith('tree-')&&!a.name.startsWith('fence-')&&!a.name.startsWith('sand-edge')&&!a.name.startsWith('bench-')&&!a.name.startsWith('lamp-')&&!a.name.startsWith('sign'));
 available.forEach((asset,i)=>{const zone=asset.category==='beach'?'lighthouse-beach':asset.category==='food'?'bread-forest':zones[i%zones.length],z=game.world.zones[zone];
  const angle=i*2.399963,radius=190+(i%5)*53,tx=z.x+Math.cos(angle)*radius,ty=z.y+180+Math.sin(angle)*radius*.6;
  if(!game.walkable(tx,ty))return;
  // Reserve the main walking line and furniture approaches.
  if(Math.hypot(tx-z.spawn[0],ty-z.spawn[1])<110)return;
  objects.push({name:asset.name,asset:asset.name,x:tx,y:ty,scale:.24,art:art(asset)});
 });
 game.drawHooks.push(()=>objects);game.assets={count:library.length,replaced,placed:objects.length,library,objects};
}
