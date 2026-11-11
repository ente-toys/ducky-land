// fA ownership: the two landmark courts. No combat, cover walls or other districts.
import fs from 'node:fs';
import {writeArcadeModules} from './arcade-modules.mjs';
export function buildSites({root,write,reuse,add,building,rect,flats,sources,areas}) {
 const svg=(name,w,h,body)=>write(`${root}/home/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><g stroke="#39472d" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`);
 svg('site-a-cauldron',350,290,`
 <path d="M25 225L74 196H276L325 225V248L267 280H83L25 248Z" fill="#93729e"/>
 <path d="M25 225L83 257H267L325 225L267 196H83Z" fill="#d9b8df"/>
 <path d="M49 199L95 176H255L301 199V221L255 246H95L49 221Z" fill="#b591c0"/>
 <path d="M49 199L95 222H255L301 199L255 176H95Z" fill="#edceea"/>
 <path d="M98 167L90 204M252 167L260 204" stroke="#39472d" stroke-width="13"/>
 <path d="M91 98Q70 208 175 213Q280 208 259 98Z" fill="#654569"/>
 <path d="M235 112Q256 172 214 201Q272 191 259 98Z" fill="#4e3657" stroke="none"/>
 <path d="M90 122Q52 101 68 145Q74 160 90 151M260 122Q298 101 282 145Q276 160 260 151" fill="none" stroke-width="8"/>
 <ellipse cx="175" cy="100" rx="92" ry="38" fill="#b591c0"/>
 <ellipse cx="175" cy="100" rx="77" ry="27" fill="#b6d93b"/>
 <path d="M220 111Q239 106 238 121L235 158Q228 171 224 158L226 127Q214 127 220 111Z" fill="#d0e967"/>
 <g fill="#e6f493"><ellipse cx="138" cy="94" rx="13" ry="8"/><ellipse cx="184" cy="109" rx="11" ry="7"/><ellipse cx="212" cy="90" rx="8" ry="5"/><circle cx="158" cy="55" r="10"/><circle cx="199" cy="32" r="7"/><circle cx="178" cy="14" r="4"/></g>
 <g fill="none" stroke="#d0e967" stroke-width="3"><path d="M127 57Q115 44 126 31M222 61Q236 47 226 36"/></g>
 <path d="M157 178Q165 167 171 146Q181 159 191 162L186 178Q205 180 202 186Q175 196 148 186Q143 181 157 178Z" fill="#bc88ce"/>
 <path d="M83 258V279M267 258V279M95 223V245M255 223V245" fill="none" stroke="#93729e"/>`);
 svg('site-a-glow',440,220,'<ellipse cx="220" cy="110" rx="195" ry="87" fill="none" stroke="#d0e967" stroke-width="12"/><ellipse cx="220" cy="110" rx="180" ry="77" fill="none" stroke="#b6d93b" stroke-width="3"/>');
 // The small chapel preserves Home's approved domed shop geometry and front-facing camera.
 reuse('site-b-chapel','/pixi-art/home-hamlets/petalpatch/house-domed-pottery-shop.svg',{'#fff0c7':'#d9b8df','#e1c58d':'#b591c0','#e1bb4b':'#168f98','#b08cba':'#168f98','#f4d3c7':'#d9b8df','#f1dbc6':'#d9b8df','#75bfc5':'#f5e277','#70a645':'#b6d93b','#6a9d3d':'#a1c238'});
 const chapelFile=`${root}/home/site-b-chapel.svg`;
 let chapel=fs.readFileSync(chapelFile,'utf8').replace('</svg>','<g stroke="#39472d" stroke-width="1.8" stroke-linejoin="round"><path d="M158 82V54Q180 22 202 54V82Z" fill="#d9b8df"/><path d="M165 76V56Q180 34 195 56V76Z" fill="#654569"/><path d="M170 67Q175 63 175 54Q180 45 185 54Q185 63 190 67Z" fill="#f5e277"/><circle cx="180" cy="70" r="3" fill="#d9a94c"/><path d="M149 47L180 18L211 47Z" fill="#168f98"/></g></svg>');
 fs.writeFileSync(chapelFile,chapel);
 // The horseshoe uses three drawn straight modules, never a bowed lintel.
 writeArcadeModules(root);
 fs.copyFileSync(`${root}/home/site-b-arcade-front.svg`,`${root}/home/site-b-arcade.svg`);
 svg('site-bed',250,110,'<path d="M12 30Q38 4 103 14Q199 0 238 31L234 77Q177 112 33 86L12 65Z" fill="#93729e"/><path d="M12 30Q42 4 103 14Q199 0 238 31Q242 74 130 79Q26 79 12 30Z" fill="#b6d93b"/><path d="M19 53Q90 90 235 51" fill="none" stroke="#78962d"/>');
 reuse('site-willow','/pixi-art/detail/nature--tree-willow.svg',{'#4aa539':'#b6d93b','#2b7a37':'#78962d','#89c332':'#d0e967','#232323':'#39472d','#49a43a':'#b6d93b','#52b33f':'#b6d93b','#328126':'#78962d','#3a952c':'#78962d','#479b36':'#9dbf40','#61c34d':'#d0e967','#6ab55f':'#d0e967','#7ece6e':'#d0e967'});
 areas['site-a'].court=[495,325];areas['site-b'].court=[500,330];
 building('site-a-apothecary','studio',1620,3480,350,310);
 building('site-a-cottage','cottage',2480,3450,360,320);
 add('site-a-cauldron','site-a-cauldron',2050,3700,350,290,{shadowSize:[125,24]});
 rect('site-a-cauldron','landmark',1945,3530,210,140);
 flats.push({src:'home/site-a-glow.svg',x:2050,y:3715,width:440,height:220,anchor:{x:.5,y:.5}});
 building('site-b-shrine','site-b-chapel',6350,3490,390,340);
 building('site-b-cottage','porch',6820,3500,340,300);
 for(const [i,x,y] of [[0,6030,3540],[1,5920,3690],[2,6000,3860],[3,6660,3540],[4,6770,3690],[5,6690,3860]]) {
  const view=['front','left','right','front','right','left'][i];
  add(`site-b-arcade-${i}`,`site-b-arcade-${view}`,x,y,190,225,{view,shadowSize:[58,8]});
  for(const [j,dx] of [-62,62].entries())rect(`site-b-arcade-${i}-pier-${j}`,'landmark',x+dx-12,y-35,24,24);
 }
 for(const [id,x,y,colour] of [['a-west',1590,3800,'orchid'],['a-east',2490,3790,'lime'],['b-west',5980,4000,'lime'],['b-east',6740,4000,'orchid']]){
  flats.push({src:'home/site-bed.svg',x,y,width:250,height:110,anchor:{x:.5,y:1}});
  add(`site-bed-${id}-bush`,'bush-2-'+colour,x-35,y-35,168,110,{homeSource:'/pixi-art/plants/bush-2.svg',wind:true,shadowSize:[40,10]});
  add(`site-bed-${id}-flowers`,'flowers',x+68,y-16,75,55,{homeSource:sources.flowers,shadow:false});
 }
 for(const [i,x,y] of [[0,1750,3950],[1,2360,3940],[2,6160,4030],[3,6530,4030]])add(`site-seat-${i}`,'bench',x,y,147.24,83.34,{anchor:{x:.5,y:451/463},homeSource:sources.bench,shadowSize:[65,12]});
 for(const [i,x,y] of [[0,1770,3510],[1,2310,3500],[2,6120,3500],[3,6570,3500]])add(`site-lantern-${i}`,'lantern',x,y,65,155,{homeSource:sources.lantern,shadowSize:[14,8]});
 for(const [i,x,y] of [[0,5650,3430],[1,5850,3340]]){
  // boss 11 Nov: no willows; the Bog uses only our recoloured tree kit.
  add(`site-b-willow-${i}`,i?'tree-2-lime':'tree-4-lime',x,y,i?180:200,i?360:280,{shadowSize:[i?39.6:44,17]});
  rect(`site-b-willow-${i}`,'tree',x-14,y-23,28,22);
 }
 flats.push({src:'home/lily-0.svg',x:5790,y:3520,width:70,height:36,anchor:{x:.5,y:.5}});
 add('site-b-pool-reeds','reeds',5660,3590,72,95,{homeSource:sources.reeds,shadow:false,wind:true});
 return {pool:{id:'site-b-willow-pool',points:[[5650,3490],[5740,3370],[5900,3410],[5950,3540],[5870,3620],[5700,3600]]}};
}
