import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
function splitDetailSVG(text){
  const match=text.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if(!match)throw Error('Invalid detail SVG');
  const attrs=match[1],attribute=name=>attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`))?.[1];
  const w=parseFloat(attribute('width')),h=parseFloat(attribute('height'));
  const viewBox=attribute('viewBox')??`0 0 ${w} ${h}`;
  const root=attrs.replace(/\s+(?:width|height|viewBox)\s*=\s*(?:"[^"]*"|'[^']*')/g,'').trim();
  return {drawing:{attrs:root,body:match[2]},viewBox,w,h};
}

export async function detailSources(entries,publicDir){
 const pieces={};
 for(const src of [...new Set(entries.map(e=>e.src).filter(s=>s?.endsWith('.svg')))].sort()){
  const p=splitDetailSVG(await readFile(path.join(publicDir,src),'utf8'));
  pieces[src]={drawing:createHash('sha256').update(JSON.stringify(p.drawing)).digest('hex'),viewBox:p.viewBox};
 }
 return pieces;
}
