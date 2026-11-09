import {readFileSync,writeFileSync} from 'node:fs';const F='src/pixi/home-expansion.json',E=JSON.parse(readFileSync(F));
const move=(id,x,y)=>{const p=E.props.find(p=>p.id===id);if(p){if(p.footprint){p.footprint.x+=x-p.x;p.footprint.y+=y-p.y;}p.x=x;p.y=y;if(p.z!==undefined)p.z=y;}else E.reviewProps[id]={...E.reviewProps[id],x,y};};
for(const v of [['grow-bush-1',255,1690],['hamlet-petalpatch-drying-shelves',-680,3840],['bigger-community-476',-180,2570],['home-beach-spare-lounger',4480,2660],['bush-1',3190,1920],['spur-cover-2',4820,1840],['bigger-community-509',6380,2860],['hamlet-butterbill-cafe-west-table',-1310,625],['hamlet-clovercrust-hay',5200,60],['hamlet-petalpatch-reading-flower-shrub',-1490,4080]])move(...v);
// Every route tip is an actual use: the seed lane arrives at a compact gardener's seat.
const b=E.props.find(p=>p.id==='hamlet-lanternleaf-bench-west');const seat=structuredClone(b);seat.id='review-seedshare-seat';delete seat.communityRole;const dx=4272-seat.x,dy=220-seat.y;seat.x=4272;seat.y=220;seat.z=220;if(seat.footprint){seat.footprint.x+=dx;seat.footprint.y+=dy;}E.props=E.props.filter(p=>p.id!==seat.id).concat(seat);
// Thin only the open east field after repainting; retain the planting edges.
E.groundDecals=E.groundDecals.filter((d,i)=>!(d.x>6000&&d.x<7500&&d.y>2500&&d.y<3750&&i%3===0));
writeFileSync(F,JSON.stringify(E,null,2)+'\n');
