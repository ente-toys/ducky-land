import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {DEPTH_LAYOUT} from './depth-layout.mjs';
const children=n=>Array.from(n.childNodes).filter(c=>c.nodeType===1);
// Annotate in place: no geometry, paint order, colour or existing transform changes.
export function applyDepth(svg,meta){
 const spec=DEPTH_LAYOUT[meta.art];if(!spec)throw Error(`No depth layout: ${meta.art}`);
 const doc=new DOMParser().parseFromString(svg,'image/svg+xml'),root=doc.documentElement;
 root.setAttribute('data-layer','ground');
 for(const p of spec.pieces)for(const path of p.nodes){
  let el=root;for(const k of path.split('.'))el=children(el)[Number(k)];
  if(!el)throw Error(`${meta.art}/${p.id}: missing SVG node ${path}`);
  if(el.getAttribute('data-piece'))throw Error(`${meta.art}: duplicate node ${path}`);
  el.setAttribute('data-piece',p.id);
  if(!el.getAttribute('id'))el.setAttribute('id',`${p.id}-${path.replaceAll('.','-')}`);
 }
 for(const [path,ids]of Object.entries(spec.segments??{})){
  let el=root;for(const k of path.split('.'))el=children(el)[Number(k)];
  const parts=el.getAttribute('d').split(/(?=M)/).filter(s=>s.trim());
  if(parts.length!==ids.length)throw Error(`${meta.art}/${path}: expected ${ids.length} independent subpaths, got ${parts.length}`);
  const group=doc.createElementNS(root.namespaceURI,'g');
  for(const a of Array.from(el.attributes))if(a.name!=='d')group.setAttribute(a.name,a.value);
  parts.forEach((d,n)=>{const part=doc.createElementNS(root.namespaceURI,'path');part.setAttribute('d',d);part.setAttribute('data-piece',ids[n]);part.setAttribute('id',`${ids[n]}-${path.replaceAll('.','-')}-${n}`);group.appendChild(part);});
  el.parentNode.replaceChild(group,el);
 }
 const tallPieces=spec.pieces.map(({id,foot,base})=>({id,foot,footprint:base.length===4&&typeof base[0]==='number'?Array.from({length:16},(_,k)=>{const a=k*Math.PI/8;return [+(base[0]+Math.cos(a)*base[2]).toFixed(3),+(base[1]+Math.sin(a)*base[3]).toFixed(3)];}):base}));
 const blocked=[...meta.blocked.filter(b=>spec.keep.includes(b.what)),...tallPieces.map(p=>({what:p.id,piece:p.id,polygon:p.footprint}))];
 return {svg:new XMLSerializer().serializeToString(doc),meta:{...meta,tallPieces,blocked}};
}
