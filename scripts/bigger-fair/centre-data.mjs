export const FIT={cx:3570,cy:2220,sx:4.3,sy:3.8};
const P=([x,y])=>[3570+(x-768)*4.3,2220+(y-520)*3.8];
export const TREE_CLUMPS=[
 [{nod:0,at:P([120,140])},{model:3,at:P([110,190])}],
 [{nod:2,at:P([1120,140])},{model:3,at:P([1120,203])}],
 [{nod:3,at:P([1390,180])},{model:0,at:P([1410,245])}],
 [{nod:4,at:P([370,910])},{model:3,at:P([320,893])}],
 [{nod:5,at:P([1070,910])},{model:3,at:P([1122,893])}],
 [{nod:6,at:P([120,660])},{model:3,at:P([170,680])}]
];
export const SLEEP_TREES=Array.from({length:7},(_,i)=>i===1?P([390,140]):TREE_CLUMPS.flat().find(t=>t.nod===i).at);
export const SLEEP_POINTS={
 hammock:[[210,140],[980,910],[1380,280]],
 rock:[[480,140],[190,910],[1310,550],[330,660]],
 leaf:[[1030,140],[550,910],[120,280],[1380,750],[680,390],[890,750]],
 book:[[300,140],[1250,910],[260,660],[1240,660],[555,820],[1030,280]],
 chair:[[1300,140],[280,870]],
 wing:[[1210,140],[460,910],[190,750],[190,220],[1170,600],[890,910],[660,530]],
 box:[[660,930],[1160,910],[120,810],[960,750],[1310,220]]
};
for(const [pose,points] of Object.entries(SLEEP_POINTS))SLEEP_POINTS[pose]=points.map((p,i)=>[...P(p),!!(i%2)]);
