import{readFileSync,writeFileSync}from'node:fs';
const read=p=>JSON.parse(readFileSync(p)),A='public/pixi-art/themes/sunflower/',D='rive/web/themes/sunflower/';
const art=read(A+'art.json'),world=read(D+'world.json'),centre=read(A+'bloom/centre-placements.json');
centre.props=centre.props.map(p=>art.props.find(q=>q.id===p.id)??p);
centre.walkBlockers=centre.walkBlockers.map(o=>world.obstacles.find(q=>q.name===o.name)??o);
centre.centrePlacementReplacement.blocked=centre.centrePlacementReplacement.blocked.map(o=>world.obstacles.find(q=>q.name===o.name)??o);
world.centrePlacement.blocked=world.centrePlacement.blocked.map(o=>world.obstacles.find(q=>q.name===o.name)??o);
writeFileSync(A+'bloom/centre-placements.json',JSON.stringify(centre,null,2)+'\n');writeFileSync(D+'world.json',JSON.stringify(world,null,1)+'\n');
