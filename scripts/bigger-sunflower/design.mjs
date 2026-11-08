// Authored farm composition. Repetition below describes planted crop beds and material texture,
// never a random placement rule. Every building, tree and piece of furniture has a fixed coordinate.
export const bounds={width:12000,height:8400,origin:{x:-2000,y:-1400}};
export const coast=Array.from({length:180},(_,i)=>{const a=i*Math.PI/90,r=1+.022*Math.sin(5*a)+.014*Math.cos(9*a);return [Math.round(4000+5500*r*Math.cos(a)),Math.round(2800+3700*r*Math.sin(a))]});
import {communities} from './communities.mjs';
export const places=communities;
export const lanes=[
 [[1780,600],[3300,100],[5300,200],[6750,450],[7750,-80],[8420,1000],[8470,3070],[8120,4420],[6540,5400],[5160,6000],[3850,5920],[1850,5610],[100,4580],[-570,3470],[-550,1700],[1780,600]],
 [[1780,600],[1700,800],[1600,1000]],[[3300,100],[3300,700],[3180,1250]],
 [[6750,450],[6750,700],[6500,950]],[[8470,3070],[7900,2850],[6880,2450]],
 [[3850,5920],[4300,5200],[4470,4140]],[[1850,5610],[1800,5100],[2250,4650]],
 [[-570,3470],[-100,3700],[600,3500]],
 // Only three short residential branches. Northern homes front the main road;
 // their former parallel lanes are gardens again.
 ...communities.filter(c=>['whirlyseed','petalpost','seedwake'].includes(c.id)).map(c=>c.lane),
];
export const roadWidths=lanes.map((_,i)=>i===0?210:i<8?150:105);
export const kit=[
 ['pollenpatch','honey',2690,-120,.84],['pollenpatch','cart',2270,470,.4],['pollenpatch','barrel',2260,280,.8],
 ['pollenpatch','tree3',450,400,1.1],['pollenpatch','tree4',3140,180,1.05],['pollenpatch','bench',1850,700,.19],['pollenpatch','sun',1940,490,1.1],
 ['hayhello','barn',7870,590,1.18],['hayhello','hay',8170,780,1.1],['hayhello','haystack',7660,800,1],['hayhello','cart',7800,630,.46],
 ['hayhello','barrel',8010,770,.85],['hayhello','barrel',8130,770,.75],['hayhello','tree3',5280,-150,1.2],['hayhello','tree4',7550,70,1.1],
 ['hayhello','fence',7730,1020,1.3],['hayhello','bench',6420,530,.2],['hayhello','sun',8250,800,1.1],
 ['whirlyseed','windmill',8510,1710,1.22],['whirlyseed','cart',9000,2090,.43],['whirlyseed','barrel',8230,1930,.85],
 ['whirlyseed','hay',8810,1940,.95],['whirlyseed','tree4',8600,1500,1.1],['whirlyseed','bench',8520,3030,.2],
 ['whirlyseed','sun',7930,2250,1.1],['whirlyseed','table',8760,3050,.18],['whirlyseed','planter',8700,3200,.9],
 ['petalpost','flowers',5060,5520,.85],['petalpost','honey',5500,5500,.85],['petalpost','cart',5900,5780,.43],
 ['petalpost','tree3',2550,5590,1.1],['petalpost','tree4',6050,5700,1.2],['petalpost','bench',4020,5820,.19],
 ['petalpost','planter',4890,5760,1],['petalpost','planter',5250,5730,1],['petalpost','planter',5660,5770,1],
 ['petalpost','sun',4560,6150,1.2],['petalpost','sun',6020,6080,1.1],['petalpost','table',3620,5790,.18],
 ['seedwake','flowers',-60,2380,.85],['seedwake','cart',-70,3070,.4],['seedwake','barrel',-370,3210,.85],
 ['seedwake','haystack',-290,3340,.9],['seedwake','tree4',-1120,2600,1.15],['seedwake','bench',-980,3660,.19],
 ['seedwake','sun',100,3610,1.1],['seedwake','planter',-840,3290,.95],['seedwake','lamp',-550,3700,.26],
];
export const sources={barn:'detail/barn.svg',windmill:'detail/windmill.svg',hay:'detail/hay-round.svg',haystack:'detail/hay-stack.svg',barrel:'detail/barrel-seeds.svg',cart:'detail/seed-cart.svg',honey:'detail/stall-honey.svg',flowers:'detail/stall-flowers.svg',planter:'detail/planter.svg',sun:'detail/sunflower-tall.svg',fence:'detail/fence.svg',arch:'detail/arch.svg',picnic:'detail/picnic.svg',table:'reuse/picnic-table.svg',bench:'reuse/street--bench-wood.svg',lamp:'reuse/lamp-lantern.svg',tree3:'reuse/tree-3.svg',tree4:'reuse/tree-4.svg'};
