import fs from 'node:fs';
export const bridges=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/water-geometry.json')).bridges;
const B=Object.fromEntries(bridges.map(b=>[b.id,b]));
export const routes=[];
const add=(id,points,width=128,terminal=null)=>routes.push({id,points,width,terminal});
add('outer-west',[B['north-west-0'].a,[1540,-280],[1200,-40],[800,340],[-500,420],[-750,650],[-800,950],[-850,1300],[-930,1450],[-1100,2000],[-1120,2800],[-800,3130],[-500,3130],[-350,3160],[-40,3220],[120,3160],B.west.a]);
add('outer-north',[B['north-west-0'].b,[2500,240],B.north.a,[3300,180],[4200,50],[5200,340],B['north-main-1'].a]);
add('outer-northeast',[[5200,340],[6150,50],[6990,540],[7300,740],[7650,1050],[7670,1800],B['east-main-1'].a]);
add('outer-east',[B['east-main-1'].a,[7440,1910],[8000,2070],[8110,2320],[8040,2510],[8080,2720],[8130,2860],[8050,2970],B.east.b,[7750,3820],[7450,4610],B['south-east-0'].b]);
add('outer-southeast',[B['south-east-0'].a,[6050,5860],[5590,5860],[5860,5300],B['south-main-1'].a]);
add('outer-southwest',[B.west.a,[250,3920],[1300,4760],[2250,5520],[3350,5950],[4050,5780],B.south.b]);
add('outer-south',[[4050,5780],[4400,6140],[4950,6380],[5590,5860]]);
add('west-bank',[[-350,3160],[-300,2940],[180,2820],[700,2230],B['west-main-1'].a]);
add('olive-islet',[[800,340],[600,800],[650,1100],[760,1410],[1050,1410],B['olive-arch'].a],104);
for(const b of bridges)add('bridge-'+b.id,[b.a,b.b],b.w,'bridge');
add('north-piazza',[B.north.b,[2900,1170],[2850,1320],[2700,1650],[2550,1920]],128,'piazza');
add('olive-piazza',[B['olive-arch'].b,[2050,1950],[2550,1920],[2630,2250],[2680,2600],[2830,2820],[3050,2800]],104,'piazza');
add('west-piazza',[B['west-main-1'].b,[1630,2340],[2100,2540],[2600,2670],[2780,2770],[3050,2800]],128,'piazza');
add('west-pond',[B.west.b,[1200,3560],[1430,3780],B.pond.b]);
add('pond-north',[B.pond.a,[1970,2760],[2200,2540]],104);
add('pond-garden',[B.pond.b,[2140,3990],[2750,4370],[3000,4220],[3400,4220],[3780,4250]],104,'fountain court');
add('piazza-fountain',[[4100,3290],[4100,3900]],128,'fountain court');
add('fountain-south',[[4100,4590],B.south.a],128,'fountain court');
add('east-piazza',[B.east.a,[6800,3050],[6670,2950],[6550,2940],[6150,2860],[5750,2770],[5480,2850],[5100,2860]],128,'piazza');
add('northeast-piazza',[B['east-main-1'].b,[6150,1910],[5700,1930],[5630,2250],[5520,2600],[5430,2820],[5100,2860]],128,'piazza');
add('north-east-piazza',[B['north-main-1'].b,[5950,1490],[6110,1620],[6150,1800],[6150,1910]],128,'piazza');
add('garden-east',[[4440,4250],[4900,4250],[5150,4250],[5450,4430],[5800,4230],[6090,3650],[5850,3370],[5500,3100],[4970,3000]],104,'piazza');
add('south-main-garden',[B['south-main-1'].b,[5800,4400],[5800,4230]]);
add('garden-arch-approach',[B['garden-arch'].a,[5950,4240],[5800,4230]],104);
add('garden-arch-outer',[B['garden-arch'].b,[6500,5100],[6270,5550],[6050,5860]],104);
add('bellpeep-arrival',[[3300,180],[3380,-160],[3480,-420]],104,'bellpeep court');
add('olivello-arrival',[[180,2820],[80,2670],[-100,2520]],104,'olivello court');
add('tessera-arrival',[[8050,2970],[8250,2930],[8370,2780]],104,'tessera court');
add('crumbbell-arrival',[[4950,6380],[4930,6590],[4800,6810],[4590,6790]],104,'crumbbell court');
add('harbour',[[4800,6810],[4800,7000],[4600,7140]],104,'dock');
export const destinationCourts=[
 {id:'centre-piazza',x:4100,y:2490,rx:1160,ry:850},
 {id:'fountain-court',x:4100,y:4250,rx:390,ry:390}
];
