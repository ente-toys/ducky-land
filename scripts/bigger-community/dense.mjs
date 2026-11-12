import fs from 'node:fs';
const S='scripts/bigger-community/', A='public/pixi-art/themes/community/';
const p=JSON.parse(fs.readFileSync(S+'dense-before-plan.json'));
const plots={
 storynest:[[-30,170],[490,130],[1030,190],[-20,1040],[450,1160],[940,910]],
 patchwing:[[7510,760],[7970,710],[8480,790],[7600,1680],[8110,1700],[8620,1740]],
 sproutshare:[[250,4920],[770,4890],[1280,4970],[420,5810],[970,5780]],
 lanternloaf:[[7000,4900],[7500,4860],[8000,4940],[7150,5800],[7680,5770]],
};
function move(id,x,y){
 const q=p.props.find(q=>q.id===id);if(!q)throw Error(id);
 const dx=x-q.x,dy=y-q.y;q.x=x;q.y=y;if(q.sortY!==undefined)q.sortY=y;
 for(const o of p.obstacles.filter(o=>o.id===id||o.id.startsWith(id+'-fence'))){
  if(o.poly)o.poly=o.poly.map(([a,b])=>[a+dx,b+dy]);else{o.x+=dx;o.y+=dy;}
 }
}
for(const c of p.communities){
 const homes=p.homes.filter(h=>h.community===c.id);
 for(let i=0;i<homes.length;i++){
  const h=homes[i],[x,y]=plots[c.id][i],dx=x-h.x,dy=y-h.y;
  const at=p.props.findIndex(q=>q.id===h.id);
  for(const q of p.props.slice(at,at+4))move(q.id,q.x+dx,q.y+dy);
  h.x=x;h.y=y;h.door=[x,y+22];
  const q=p.props[at],scale=[1.12,.90,1.03,.91,1.12,.96][i];q.scale=scale;
  const o=p.obstacles.find(o=>o.id===h.id);o.y=y-110*scale;o.rx=164*scale;o.ry=66*scale;
 }
 c.homes=plots[c.id];
}
function byName(zone,name,index=0){return p.props.filter(q=>q.zone===zone&&q.name===name)[index];}
function at(zone,name,x,y,index=0){const q=byName(zone,name,index);if(!q)throw Error(zone+' '+name);move(q.id,x,y);}
at('storynest','binding-desk',1450,790);p.workStops[0].point=[1450,835];
at('storynest','washing-line',-380,850);
at('patchwing','washing-line',8970,1970);
at('sproutshare','washing-line',-240,5700);
at('lanternloaf','washing-line',8150,6050);
for(const c of p.communities){const q=byName(c.id,'washing-line');for(const [side,dx]of [['left',-215],['right',215]]){const o=p.obstacles.find(o=>o.id===`wash-${side}-${c.id}`);o.x=q.x+dx;o.y=q.y-10;}}
for(const [i,x,y]of [[1,1810,5830],[2,2150,5830],[3,1810,6090],[4,2150,6090]])at('sproutshare','raised-bed-'+i,x,y);
p.loop=[[-500,2800],[-470,2390],[-250,1650],[700,1400],[2300,100],[4000,50],[5800,100],[7000,900],[8010,1200],[8430,2950],[8380,3555],[8100,4140],[7550,5280],[5600,5570],[4000,6140],[2700,5600],[920,5280],[-250,4100],[-470,3480],[-500,2800]];
p.links=p.links.slice(0,9);
p.links[4]=[[7550,5280],[6500,4840],[6332,4616]];
p.links.push([[-470,3480],[-800,3570],[-1120,3590],[-1120,3380]],[[8380,3555],[8700,3840],[9080,3990],[9080,3740]]);
p.lanes=[
 [[700,1400],[1460,1220],[1510,820],[1110,490],[570,460],[-30,470]],
 [[8010,1200],[8640,1240],[8890,1840],[8670,2230],[8160,2380],[7800,2300],[7460,2100]],
 [[920,5280],[-40,5280],[-150,5570],[190,6090],[1020,6080],[1550,6050],[2040,5570]],
 [[7550,5280],[8250,5430],[8510,5390]],
 [[7550,5280],[6580,5420],[6410,5700],[6930,6070],[7730,6040],[8150,6070]],
];
for(const [i,c]of p.communities.entries())c.lane=p.lanes[i===3?4:i];
p.dense=true;p.roadWidths={main:185,link:110,lane:82,door:54};
const well=`<svg xmlns="http://www.w3.org/2000/svg" width="174" height="180" viewBox="0 0 174 180"><g stroke="#65564D" stroke-width="4" stroke-linejoin="round"><ellipse cx="87" cy="145" rx="70" ry="23" fill="#7C9C55" opacity=".25" stroke="none"/><path d="M30 114v31q57 34 114 0v-31" fill="#C4B69A"/><ellipse cx="87" cy="115" rx="57" ry="22" fill="#F6E5BD"/><ellipse cx="87" cy="115" rx="38" ry="11" fill="#6D9DA4"/><path d="M31 117V49h12v68M131 117V49h12v68" fill="#BD9466"/><path d="M14 53L51 15h72l37 38Z" fill="#A89ACF"/><path d="M29 51h116M54 25h66" fill="none" stroke="#D6C5E6"/><path d="M88 54v52" fill="none" stroke="#9A8057" stroke-width="3"/><path d="M77 100h23l-3 18H80Z" fill="#D5AE78"/><path d="M76 101q10 -15 24 0" fill="none"/><path d="M44 144l4 -16M69 155v-17M108 155v-17M134 144l-4 -16" fill="none" stroke-width="2"/></g></svg>`;
fs.writeFileSync(A+'expansion/shared-well.svg',well);
function custom(name,src,x,y,width,height,scale,zone,rx,ry){
 const id='dense-'+name;p.props.push({id,name,src,x,y,width,height,scale,anchor:{x:.5,y:1},zone});
 if(rx)p.obstacles.push({id,x,y:y-8,rx,ry});
}
for(const [zone,x,y]of [['storynest',790,530],['patchwing',8200,1190],['sproutshare',1040,5350],['lanternloaf',7990,5380]])custom(zone+' well','expansion/shared-well.svg',x,y,174,180,1,zone,55,18);
for(const [zone,x,y,s]of [
 ['storynest',-180,0,.85],['storynest',220,-310,.95],['storynest',660,-290,.85],['storynest',1110,-210,1],
 ['patchwing',9060,1030,.86],['patchwing',9160,1480,.95],['patchwing',9180,1880,.86],
 ['sproutshare',350,6330,.86],['sproutshare',760,6470,.95],['sproutshare',1190,6410,.86],['sproutshare',1610,6500,.90],
 ['lanternloaf',6820,6380,.85],['lanternloaf',7240,6460,.95],['lanternloaf',7690,6360,.85]
])custom(zone+' orchard '+x,'expansion/orchard-tree.svg',x,y,310,440,s,zone,25*s,18*s);
const bed=p.props.find(q=>q.name==='raised-bed-1');
for(const [name,zone,x,y]of [['story herbs','storynest',-360,1400],['maker dye plants','patchwing',8740,2630],['bakery herbs','lanternloaf',6530,6120]])custom(name,bed.src,x,y,bed.width,bed.height,.85,zone,95,22);
p.denseGardens=[
 {zone:'storynest',points:[[-530,-50],[1270,-430],[1580,-80],[1320,220],[-260,270]]},
 {zone:'patchwing',points:[[8880,650],[9230,900],[9410,1900],[8980,2200],[8850,1510]]},
 {zone:'sproutshare',points:[[40,6170],[1810,6230],[1940,6580],[550,6730],[20,6530]]},
 {zone:'sproutshare-field',points:[[1630,5640],[2360,5670],[2370,6240],[1630,6270]]},
 {zone:'lanternloaf',points:[[6500,6170],[7930,6130],[8090,6450],[6920,6670],[6510,6500]]},
];
p.places=p.communities;
fs.writeFileSync(S+'plan.json',JSON.stringify(p,null,2)+'\n');
console.log('Authored tighter plots, four wells, fourteen orchard trees and one road circuit.');
