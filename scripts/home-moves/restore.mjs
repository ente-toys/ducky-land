// Round 9: restore every non-approved missing drawing from the resolved main snapshot.
import fs from 'node:fs';
import {loadPlacements} from './data.mjs';
const file='src/world/home/home-expansion.json',E=JSON.parse(fs.readFileSync(file)),B=JSON.parse(fs.readFileSync('review/moves/baseline.json')),P=await loadPlacements();
if(fs.existsSync('review/moves/restored.json'))throw Error('Restoration snapshot already exists; use the placement scripts for follow-up edits.');
const existing=new Set(P.createPlacements().map(p=>String(p.id)));
const missing=B.props.filter(p=>!existing.has(String(p.id)));
const approved=p=>/bench|reading-bench|raised-bed|flour-sacks|vegetable|crop-|windmill|cottage-netmaker|farm-enclosure|beach-lounger/.test(p.src)||p.id==='review-seedshare-seat';
const restore=missing.filter(p=>!approved(p));
fs.writeFileSync('review/moves/round8-props.json',JSON.stringify(P.createPlacements()));
fs.writeFileSync('review/moves/restored.json',JSON.stringify(restore.map(p=>({id:String(p.id),art:p.src,main:[p.x,p.y],final:[p.x,p.y],distance:0,verdict:'RESTORED-EXACT'})),null,2));
E.removedProps=E.removedProps.filter(id=>!restore.some(p=>String(p.id)===id));
for(const p of restore){if(!/^(?:tree-|flower-|grow-tree-)/.test(p.id)&&!E.props.some(q=>String(q.id)===String(p.id))){const {footprint,bodyFootprint,outlineKind,sortY,z,...raw}=p;E.props.push(raw);}E.reviewProps[p.id]={x:p.x,y:p.y};}
fs.writeFileSync(file,JSON.stringify(E,null,2)+'\n');
console.log({missing:missing.length,restore:restore.length,approved:missing.filter(approved).map(p=>p.id)});
