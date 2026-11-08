import fs from 'node:fs';
const S='scripts/bigger-community/',A='public/pixi-art/themes/community/expansion/';
const originalCoast=JSON.parse(fs.readFileSync(S+'baseline/world.json')).coast;
const p=JSON.parse(fs.readFileSync(S+'plan.json')),base=JSON.parse(fs.readFileSync(S+'baseline/art.json'));
const write=(name,w,h,body)=>fs.writeFileSync(A+name+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>Campfire Commons ${name}</title><g stroke="#65564D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`);
// Reuse the theme's detailed leaf drawing for the new orchard, with a distinct sage canopy.
let orchardSource=fs.readFileSync('public/pixi-art/themes/community/detail/tree-lilac.svg','utf8');
const foliage={'#D9B4F8':'#B6CC89','#F6EFD7':'#E5EDC5','#D6C5E6':'#BCD088','#A89ACF':'#91AE63','#7F79BB':'#718F56','#E6D9F0':'#D8E2AD','#B6A0CF':'#A2BE77'};
for(const [from,to] of Object.entries(foliage))orchardSource=orchardSource.replaceAll(from,to);
orchardSource=orchardSource.replace('width="607" height="648"','width="310" height="440" preserveAspectRatio="none"');
const fruit=[[250,420],[570,220],[880,460],[440,740],[790,750]].map(([x,y])=>`<g transform="translate(${x} ${y})"><path d="M0 -26q-15 -21 -30 -2" fill="none" stroke="#617B49" stroke-width="10"/><path d="M-3 -27q-37 -23 -59 14q-21 49 26 73q35 13 62 -14q24 -36 1 -61q-14 -18 -30 -12Z" fill="#D8A4BB" stroke="#65564D" stroke-width="8"/><path d="M-38 -4q-13 15 -4 29" fill="none" stroke="#F3CFD8" stroke-width="7"/></g>`).join('');
fs.writeFileSync(A+'orchard-tree.svg',orchardSource.replace('</svg>',fruit+'</svg>'));
function kit(src,x,y,scale,zone){const ref=base.props.find(b=>b.src===src);if(!ref)throw Error(src);const q={...ref,id:`review-${p.props.length}`,x,y,sortY:y,scale,zone};delete q.centrePiece;p.props.push(q);if(!/flower|blanket|cushion|reeds|lily/.test(src)){const w=q.width*scale,h=q.height*scale;p.obstacles.push({id:q.id,x,y:y-Math.min(30,h*.07),rx:w*(/tree/.test(src)?.12:/bench/.test(src)?.43:.38),ry:Math.max(8,Math.min(h*.11,w*.2))});}}
function orchard(x,y,scale=1){const id=`review-orchard-${p.props.length}`;p.props.push({id,name:'Shared fruit tree',src:'expansion/orchard-tree.svg',width:310,height:440,x,y,scale,anchor:{x:.5,y:1},zone:'commons'});p.obstacles.push({id,x,y:y-10,rx:25*scale,ry:18*scale});}
// Fixed individual compositions, each with an open arrival and working/sitting space.
for(const [x,y,s]of [[3200,-260,.85],[3560,-410,1],[3900,-280,.9],[4610,-280,1],[4850,-390,.85],[-160,2050,.9],[-460,2290,1],[90,2400,.88],[2700,5310,.9],[3020,5410,1],[3260,5380,.85]])orchard(x,y,s);
for(const [src,x,y,s]of [
 ['bench-lavender',3460,-120,.30],['picnic-blanket',4410,-420,.38],['cushions',4230,-380,.22],['community-crate',4720,-70,1],['signpost',3100,-20,.35],
 ['bench-lavender',-400,2530,.30],['flowers-purple',-250,2410,.18],['flowers-purple',90,2220,.18],['bush-lavender',-500,1940,.26],['signpost',250,2580,.35],
 ['picnic-blanket',2850,5600,.42],['cushions',3080,5630,.24],['community-crate',2660,5540,1],['bench-lavender',3300,5600,.30],['flowers-purple',3130,5830,.18],
 ['tree-wisteria',4950,5110,.65],['tree-lilac',5790,5290,.62],['bench-lavender',5340,5470,.30],['picnic-blanket',5700,5500,.36],['pond-reeds',5140,5330,.40],['pond-reeds',5530,5150,.36],
 ['tree-lilac',8850,4270,.62],['tree-wisteria',9160,4620,.65],['picnic-blanket',8780,4510,.36],['cushions',8590,4500,.22],['bench-lavender',8650,4700,.30],['flowers-purple',9040,4740,.18],
 ['signpost',-610,3090,.35],['flowers-purple',-700,3160,.18],['signpost',8580,3380,.35],['flowers-purple',8660,3450,.18]
])kit(`detail/${src}.svg`,x,y,s,'commons');
p.reviewCommons=[{name:'Bookmark Orchard',point:[3460,-10]},{name:'Butterfly Rest',point:[-200,2630]},{name:'Harvest Picnic Meadow',point:[2890,5760]},{name:'Lilywatch Pond',point:[5350,5510]},{name:'Riverbend Picnic',point:[8800,4700]}];
// Vertical bridges across the two streams, and the new north/south canal crossings.
p.reviewDecks=[
 {name:'North welcome bridge',x:3840,y:270,width:320,height:410,axis:'y'},
 {name:'West welcome bridge',x:610,y:2720,width:360,height:200,axis:'x'},
 {name:'South kitchen bridge',x:3515,y:4890,width:250,height:440,axis:'y'},
 {name:'Willow stream inner bridge',x:-585,y:3070,width:230,height:430,axis:'y'},
 {name:'Willow stream coast bridge',x:-1230,y:3165,width:220,height:430,axis:'y'},
 {name:'Lantern stream inner bridge',x:8250,y:3330,width:260,height:450,axis:'y'},
 {name:'Lantern stream coast bridge',x:8970,y:3530,width:230,height:460,axis:'y'}
].map((d,i)=>{const src=`review-bridge-${i}`,w=d.width,h=d.height,horiz=d.axis==='x',W=horiz?h:w,H=horiz?w:h;
 let b=`<path d="M28 ${H-18}Q${W/2} ${H-38} ${W-28} ${H-18}" fill="none" stroke="#547D75" stroke-width="14" opacity=".22"/><path d="M26 19Q${W/2} 4 ${W-26} 19V${H-25}Q${W/2} ${H-45} 26 ${H-25}Z" fill="#C59A6A"/>`;
 for(let y=35;y<H-28;y+=25)b+=`<path d="M29 ${y}Q${W/2} ${y-15} ${W-29} ${y}" fill="none" stroke="#94734F" stroke-width="3"/>`;
 for(const x of [18,W-18]){b+=`<path d="M${x} 15Q${x-7} ${H/2} ${x} ${H-15}" fill="none" stroke="#8B6B4E" stroke-width="10"/><path d="M${x-3} 15Q${x-10} ${H/2} ${x-3} ${H-15}" fill="none" stroke="#E4C796" stroke-width="5"/>`;for(const y of [20,H*.34,H*.66,H-25])b+=`<path d="M${x-7} ${y+12}v-25h14v25Z" fill="#D5AF7C" stroke-width="3"/>`;}
 const oldOutline='M'+originalCoast.map(([x,y])=>`${x-d.x} ${y-d.y}`).join('L')+'Z';
 const mask=`<defs><clipPath id="new-deck-only"><path d="M0 0H${w}V${h}H0Z${oldOutline}" clip-rule="evenodd"/></clipPath></defs>`;
 write(src,w,h,mask+`<g clip-path="url(#new-deck-only)">`+(horiz?`<g transform="translate(${w} 0) rotate(90)">${b}</g>`:b)+'</g>');
 return {...d,src:`expansion/${src}.svg`};});
fs.writeFileSync(S+'plan.json',JSON.stringify(p,null,2)+'\n');
console.log('Authored five commons and seven new canal/stream crossings.');
