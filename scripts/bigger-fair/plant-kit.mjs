// Fair shares Home's actual SVGs. Old blueprint filenames identify a size class,
// never a licence to introduce another plant drawing.
import {readFileSync} from 'node:fs';

export const HAMLET_PLANTS = {
 'tree-small-round.svg':'tree-4', 'tree-round-oak.svg':'tree-3',
 'tree-tall-oak.svg':'tree-1', 'bush-cluster.svg':'bush-2',
 'tree-cloud-oak.svg':'tree-1', 'tree-cloud-oak-short.svg':'tree-4',
 'tree-round-sapling.svg':'tree-4', 'tree-grand-oak.svg':'tree-3',
 'bush-leafy.svg':'bush-1', 'bush-white-flowers.svg':'bush-3',
 'tree-round.svg':'tree-1', 'tree-broad-canopy.svg':'tree-3',
 'tree-upright.svg':'tree-2', 'bush-round.svg':'bush-1', 'bush-low.svg':'bush-4',
 'tree-rounded.svg':'tree-4', 'tree-broad.svg':'tree-3', 'tree-slender.svg':'tree-5',
};
export const PLANT_MODELS = Object.fromEntries([
 ...[1,2,3,4,5].map(n=>'tree-'+n), ...[1,2,3,4].map(n=>'bush-'+n),
].map(name=>{
 const src=`/pixi-art/plants/${name}.svg`;
 const [,box]=readFileSync('public'+src,'utf8').match(/viewBox="([^"]+)"/);
 const [,,width,height]=box.split(/[ ,]+/).map(Number);
 return [name,{src,width,height}];
}));

export function homePlant(p) {
 const name=HAMLET_PLANTS[p.src?.split('/').at(-1)];
 if(!p.src?.startsWith('hamlets/')||!name)return {};
 const model=PLANT_MODELS[name];
 // Preserve the authored height class and foot. Use the source aspect ratio,
 // rather than stretching a Home tree into the old custom silhouette.
 return {src:model.src,width:+(p.height*model.width/model.height).toFixed(1),height:p.height};
}
