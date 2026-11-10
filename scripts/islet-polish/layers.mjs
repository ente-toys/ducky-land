import {readFileSync,writeFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {ISLET_ART,ISLET_META} from '../../src/pixi/islets.js';
import {svgLayerDocuments} from '../../src/pixi/svg-context.js';
const parse=s=>new DOMParser().parseFromString(s,'image/svg+xml'),serialize=d=>new XMLSerializer().serializeToString(d);
for(const art of ISLET_ART){
 const path=`public/pixi-art/islets/${art}.svg`,source=readFileSync(path,'utf8'),layers=svgLayerDocuments(source,parse,serialize),ground=parse(layers.ground),root=ground.documentElement;
 for(const piece of [...ISLET_META[art].tallPieces].sort((a,b)=>a.foot[1]-b.foot[1])){
  const selected=parse(layers.pieces.get(piece.id));
  for(const node of Array.from(selected.documentElement.childNodes))if(node.nodeType===1&&!['defs','title','desc'].includes(node.localName))root.appendChild(ground.importNode(node,true));
 }
 writeFileSync(path,serialize(ground).split('\n').map(l=>l.trimEnd()).join('\n')+'\n');
}
console.log('Source SVG paint order matches ground plus foot-sorted standing props.');
