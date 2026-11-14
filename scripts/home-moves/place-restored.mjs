import fs from 'node:fs';
import {loadPlacements} from './data.mjs';
import {makeAudit} from './audit.mjs';
import {inShape,geometry} from '../../assets/world/island-geometry.mjs';
import {candidateConnectivity} from './candidate-connectivity.mjs';
import {createNavigation} from '../../src/world/navigation.js';
const E=JSON.parse(fs.readFileSync('src/world/home/home-expansion.json')),B=JSON.parse(fs.readFileSync('qa/fixtures/home-moves-main.json')),rows=JSON.parse(fs.readFileSync('review/moves/restored.json')),P=await loadPlacements(),Old=await loadPlacements('HEAD');
for(const id of (process.env.EXTRA??'').split(',').filter(Boolean)){if(rows.some(r=>r.id===id))continue;const b=B.props.find(p=>String(p.id)===id);rows.push({id,art:b.src,main:[b.x,b.y],final:[b.x,b.y],distance:0,verdict:'ADJUSTED',adjustment:true});}
let props=P.createPlacements();const world=P.harborWorld(P.walkWorld(P.trimWorld(JSON.parse(fs.readFileSync('assets/world/world.json'))),props));
const oldProps=Old.createPlacements(),oldWorld=Old.harborWorld(Old.walkWorld(Old.trimWorld(JSON.parse(fs.readFileSync('assets/world/world.json'))),oldProps));
const beds=P.sleepSpots(world,props,geometry(world).walkable,P.sleepHalfWidths(.88*.24*3));
const audit=await makeAudit([...B.props,...B.decks],E,world,2,B.sourceSvg,B.surface,.01);
const waterCache=new Map();const waterOK=async p=>{if(process.env.ALLOW_CANOPY_OVERHANG)return true;const b=audit.base.get(String(p.id));if(!b)return false;const key=String(p.id);if(!waterCache.has(key))waterCache.set(key,(await audit.projectedGround(b)).water);return (await audit.projectedGround(p)).water<=waterCache.get(key)+1e-6;};
const spawn=JSON.parse(fs.readFileSync('assets/world/world.json')).zones.plaza.spawn;
const targets=[...JSON.parse(fs.readFileSync('src/rendering/pixi/environment/home-kites.json')).map(p=>[p.id,[p.x,p.y]]),['spawn',spawn],['museum',[2920,1190]],...JSON.parse(fs.readFileSync('src/gameplay/karma-sites.json')).filter(p=>p.region==='home').map(p=>[p.id,[p.x,p.y]]),...props.filter(p=>p.door).map(p=>[p.id,p.door]),...[...(E.places??[]),...(E.commons??[]),...(E.openSpaces??[])].map(p=>[p.id,p.point])];
if(process.env.PROTECT_POCKETS&&fs.existsSync('review/moves/pocket-targets.json'))targets.push(...JSON.parse(fs.readFileSync('review/moves/pocket-targets.json')).map((p,i)=>['saved grass '+i,p]));
const decks=P.HOME_DECKS.map(p=>({...p,id:p.id??'fishing-deck',scale:1,anchor:{x:0,y:0}}));
const translate=(p,x,y)=>P.solidBuilding({...p,x,y,...(p.door?{door:[p.door[0]+x-p.x,p.door[1]+y-p.y]}:{})});
const shapeBounds=new WeakMap();const hits=(p,point,pad=0)=>[p.footprint,p.bodyFootprint].some(f=>{if(!f)return false;if(!shapeBounds.has(f)){const pts=[f.poly,...(f.parts??[])].flat(),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);shapeBounds.set(f,[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]);}const b=shapeBounds.get(f),margin=(f.clearance??0)+pad;if(point[0]<b[0]-margin||point[0]>b[2]+margin||point[1]<b[1]-margin||point[1]>b[3]+margin)return false;return inShape(...point,f,margin);});
const protectedPoints=process.env.USE_CORRIDOR&&fs.existsSync('review/moves/protect.json')?JSON.parse(fs.readFileSync('review/moves/protect.json')):[];
const reasons=p=>{
 const out=protectedPoints.some(pt=>hits(p,pt))?['reconnect spawn corridor']:[];out.push(...targets.filter(([id,pt])=>id!==p.id&&hits(p,pt,id===process.env.MARGIN_TARGET?12:0)).map(([id])=>'target '+id));
 for(const b of beds){if(b.tree===p.id)continue;
 if([-22,0,22].some(dx=>p.footprint&&inShape(b.x+dx,b.y,p.footprint,p.footprint.clearance)))out.push('resident ground '+b.pose+':'+b.x+','+b.y);
 const half=p.width*p.scale/2,r=b.r;
 if(Math.hypot(b.x-p.x,(b.y-p.y)*1.6)<half*.8+r+12||(p.y>b.y-20&&p.y-b.y<p.height*p.scale*.9&&Math.abs(b.x-p.x)<half+r*.6))out.push('resident setting '+b.pose+':'+b.x+','+b.y);
 }
 if(p.door&&!process.env.IGNORE_DOOR){for(const q of props)if(q.id!==p.id&&hits(q,p.door))out.push('door blocked by '+q.id);}
 return out;
};
const offsets=[];for(let y=-248;y<=248;y+=8)for(let x=-248;x<=248;x+=8)if(Math.hypot(x,y)<=250)offsets.push([x,y]);offsets.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));const goalOffsets=process.env.CONNECT_TARGET?[...offsets.filter(([x,y])=>x%16===0&&y%16===0),...offsets.filter(([x,y])=>x%16!==0||y%16!==0)]:offsets;
const dry=geometry({...world,obstacles:[],walkways:[],bridges:[]}).walkable;
for(const row of rows){if(process.env.ONLY&&!process.env.ONLY.split(',').includes(row.id))continue;const i=props.findIndex(p=>String(p.id)===row.id),p=props[i],main=B.props.find(q=>String(q.id)===row.id);let reason=reasons(p);if((p.x!==main.x||p.y!==main.y)&&audit.ground(p)!=='grass')reason.push('nudge anchor is not on grass');if(!await waterOK(p))reason.push('drawing extends over new water');let overlap=await audit.excess(p,[...props,...decks]);
 if(!reason.length&&!overlap.length&&!process.env.CONNECT_TARGET){row.reason='Exact main position; no target/resident obstruction or added drawing overlap.';continue;}
 console.log('search',row.id,reason,overlap.map(p=>p.id));let found;const dynamicWorld=P.harborWorld(P.walkWorld(P.trimWorld(JSON.parse(fs.readFileSync('assets/world/world.json'))),props));const connect=process.env.CONNECT_TARGET||process.env.PRESERVE_AREAS?candidateConnectivity(dynamicWorld,props,beds.map(P.sleeperFootprint),new Set((process.env.CONNECT_GROUP??row.id).split(',')),spawn,JSON.parse(process.env.CONNECT_TARGET??JSON.stringify(spawn)),{allowCoveredTarget:!!process.env.COVER_POCKET,preserveAreas:!!process.env.PRESERVE_AREAS,protectTargets:[...targets.map(t=>t[1]),...(fs.existsSync('review/moves/pocket-targets.json')?JSON.parse(fs.readFileSync('review/moves/pocket-targets.json')):[])]}):null;const canConnect=connect?(connect([])||!!process.env.COVER_POCKET):true;if(connect)console.log('Can connect without candidate:',canConnect);const connectivityChecks=new Map();const connectGroup=(candidate,ids)=>{if(!connect)return true;const key=[...ids].sort().join(',');if(!connectivityChecks.has(key)){if(connectivityChecks.size>12)connectivityChecks.delete(connectivityChecks.keys().next().value);connectivityChecks.set(key,candidateConnectivity(dynamicWorld,props,beds.map(P.sleeperFootprint),ids,spawn,JSON.parse(process.env.CONNECT_TARGET??JSON.stringify(spawn)),{allowCoveredTarget:!!process.env.COVER_POCKET,preserveAreas:!!process.env.PRESERVE_AREAS,protectTargets:[...targets.map(t=>t[1]),...(fs.existsSync('review/moves/pocket-targets.json')?JSON.parse(fs.readFileSync('review/moves/pocket-targets.json')):[])]}));}return connectivityChecks.get(key)(candidate);};
 let trialCount=0;const started=Date.now();if(canConnect&&!process.env.CONNECT_GROUP)for(const [dx,dy]of goalOffsets){if(++trialCount%100===0)console.log('candidate',trialCount,'seconds',Math.round((Date.now()-started)/1000));const q=translate(p,main.x+dx,main.y+dy);if(audit.ground(q)!=='grass'||!dry(q.x,q.y-4)||reasons(q).length)continue;if((await audit.excess(q,[...props,...decks])).length)continue;if(!await waterOK(q))continue;if(connect&&!connect([q]))continue;found=q;break;}
 if(!found&&process.env.NEIGHBOURS){
 const trials=[];for(const [dx,dy]of offsets){const q=translate(p,main.x+dx,main.y+dy);if(audit.ground(q)!=='grass'||!dry(q.x,q.y-4)||reasons(q).length||!await waterOK(q))continue;const h=await audit.excess(q,[...props,...decks]);if(h.length>0&&h.length<=5){const group=new Set([row.id,...h.map(h=>String(h.id))]);if(connect&&!connectGroup([q],group))continue;trials.push({q,h,d:Math.hypot(dx,dy)});}}trials.sort((a,b)=>a.h.length-b.h.length||a.d-b.d);
 console.log('neighbour trials',row.id,trials.length);for(const {q,h}of trials.slice(0,12)){let candidate=props.map(o=>o.id===p.id?q:o),valid=true;
 for(const [hi,hit]of h.entries()){let n=candidate.findIndex(o=>o.id===hit.id);if(n<0){valid=false;break;}let other=candidate[n],b=audit.base.get(String(other.id)),support=rows.some(r=>r.id===String(other.id)&&!r.adjustment)?'grass':audit.ground(b),best;
 for(const [dx,dy]of offsets){let o=translate(other,b.x+dx,b.y+dy);if(audit.ground(o)!==support||!dry(o.x,o.y-4)||reasons(o).length)continue;if((await audit.excess(o,[...candidate.filter(p=>!h.slice(hi+1).some(h=>h.id===p.id)),...decks])).length||!await waterOK(o))continue;if(connect&&!connectGroup([q,...h.slice(0,hi).map(h=>candidate.find(p=>p.id===h.id)),o],new Set([row.id,...h.map(h=>String(h.id))])))continue;best=o;break;}if(!best){valid=false;break;}candidate[n]=best;}
 if(!valid||(await audit.excess(q,[...candidate,...decks])).length)continue;
 if(connect&&!connectGroup(candidate.filter(o=>o.id===p.id||h.some(h=>h.id===o.id)),new Set([String(p.id),...h.map(h=>String(h.id))])))continue;
 for(const hit of h){const o=candidate.find(o=>o.id===hit.id),b=audit.base.get(String(o.id));E.reviewProps[o.id]={x:o.x,y:o.y,...(o.door?{door:o.door}:{})};let r=rows.find(r=>r.id===String(o.id));if(!r){r={id:String(o.id),main:[b.x,b.y],art:o.src,adjustment:true};rows.push(r);}r.final=[o.x,o.y];r.distance=Math.hypot(o.x-b.x,o.y-b.y);r.verdict=r.adjustment?'ADJUSTED':'RESTORED-NUDGED';r.reason='Small neighbour move makes room for a restored drawing without increasing main overlap.';}
 console.log('NEIGHBOURS',row.id,h.map(o=>o.id));props=candidate;found=q;break;
 }
 }
 if(!found&&canConnect&&process.env.JOINT){
 for(const [dx,dy]of goalOffsets){const primary=translate(p,main.x+dx,main.y+dy);if(audit.ground(primary)!=='grass'||!dry(primary.x,primary.y-4)||reasons(primary).length)continue;const group=new Set((process.env.CONNECT_GROUP??row.id).split(','));let candidate,valid=true;
 for(let pass=0;pass<12;pass++){candidate=props.map(q=>{if(!group.has(String(q.id)))return q;const b=audit.base.get(String(q.id));return translate(q,b.x+dx,b.y+dy);});
 if(candidate.filter(q=>group.has(String(q.id))).some(q=>audit.ground(q)!=='grass'||!dry(q.x,q.y-4)||reasons(q).length)){valid=false;break;}
 let change=false;for(const q of candidate.filter(q=>group.has(String(q.id))))for(const h of await audit.excess(q,[...candidate,...decks])){if(!audit.base.has(String(h.id))||group.size>=16){valid=false;break;}if(!group.has(String(h.id))){group.add(String(h.id));change=true;}}
 if(!valid||!change)break;
 }
 if(!valid||!candidate||candidate.filter(q=>group.has(String(q.id))).length!==group.size)continue;
 if((await Promise.all(candidate.filter(q=>group.has(String(q.id))).map(q=>audit.excess(q,[...candidate,...decks])))).some(h=>h.length))continue;
 if((await Promise.all(candidate.filter(q=>group.has(String(q.id))).map(waterOK))).some(ok=>!ok))continue;if(connect&&!connectGroup(candidate.filter(q=>group.has(String(q.id))),group))continue;console.log('JOINT',row.id,[dx,dy],[...group]);
 for(const q of candidate.filter(q=>group.has(String(q.id)))){E.reviewProps[q.id]={x:q.x,y:q.y,...(q.door?{door:q.door}:{})};let r=rows.find(r=>r.id===String(q.id));if(!r){const b=audit.base.get(String(q.id));r={id:String(q.id),main:[b.x,b.y],art:q.src,adjustment:true};rows.push(r);}r.final=[q.x,q.y];r.distance=Math.hypot(dx,dy);r.verdict=r.adjustment?'ADJUSTED':'RESTORED-NUDGED';r.reason='Neighbour group moves together to retain original drawing overlaps and reconnect access.';}
 props=candidate;found=props[i];break;
 }
 }
 if(!found){let trials=[];for(const [dx,dy]of offsets){const q=translate(p,main.x+dx,main.y+dy);if(audit.ground(q)!=='grass'||!dry(q.x,q.y-4)||reasons(q).length)continue;const excess=await audit.excess(q,[...props,...decks]);trials.push({at:[q.x,q.y],delta:Math.hypot(dx,dy),overlaps:excess.map(h=>h.id)});}console.log('NO SPOT',row.id,trials.sort((a,b)=>a.overlaps.length-b.overlaps.length||a.delta-b.delta).slice(0,5));row.reason='PENDING: '+reason.join('; ')+overlap.map(p=>p.id).join(',');continue;}
 props[i]=found;E.reviewProps[row.id]={x:found.x,y:found.y,...(found.door?{door:found.door}:{})};row.final=[found.x,found.y];row.distance=Math.hypot(found.x-main.x,found.y-main.y);row.verdict='RESTORED-NUDGED';row.reason=reason.length?reason.join('; '):'Avoid added overlap with '+overlap.map(p=>p.id).join(', ');console.log('placed',row.id,row.distance,row.final);fs.writeFileSync('src/world/home/home-expansion.json',JSON.stringify(E,null,2)+'\n');fs.writeFileSync('review/moves/restored.json',JSON.stringify(rows,null,2)+'\n');
}
for(const q of props)if(E.reviewProps[q.id])E.reviewProps[q.id]={...E.reviewProps[q.id],x:q.x,y:q.y,...(q.door?{door:q.door}:{})};
fs.writeFileSync('src/world/home/home-expansion.json',JSON.stringify(E,null,2)+'\n');fs.writeFileSync('review/moves/restored.json',JSON.stringify(rows,null,2)+'\n');
const w=P.harborWorld(P.walkWorld(P.trimWorld(JSON.parse(fs.readFileSync('assets/world/world.json'))),props)),n=createNavigation({...w,obstacles:[...w.obstacles,...beds.map(P.sleeperFootprint)]});
for(const [id,pt]of targets)if(!n.walkable(...pt)||!n.route(...spawn,...pt).length)console.log('UNREACHABLE',id,pt,'blockers',props.filter(p=>hits(p,pt)).map(p=>p.id));
console.log('bad beds',P.sleepSpots(w,props,geometry(w).walkable,P.sleepHalfWidths(.88*.24*3)).bad);
