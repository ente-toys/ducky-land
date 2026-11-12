const SOLIDS = new Set(['review-coast-rock-a','review-coast-rock-b','review-coast-rock-c','review-coast-rock-d','review-pear-harvest-crate']);
const MOVES = {
  'hamlet-petalpatch-pottery-cottage': [-100,0],
  'hamlet-reedwhistle-cottage-fishers': [100,0],
  'hamlet-clovercrust-mill': [0,-80],
  'home-windmill-sails': [0,-80],
  'hamlet-clovercrust-silo': [80,0],
  'hamlet-reedwhistle-lighthouse': [-40,0],
  'grow-tree-3': [0,-140],
  'p2-garden-quay-shoulder-4': [0,-140],
  'hamlet-reedwhistle-rope-coil': [0,48],
  'hamlet-reedwhistle-lighthouse-rock-right': [80,-80],
  'hamlet-reedwhistle-lighthouse-rock-right-small': [80,-80],
  'hamlet-butterbill-cafe-west-chair': [-40,0],
  'hamlet-butterbill-cafe-west-table': [-40,0],
  'hamlet-butterbill-cafe-east-back-chair': [30,0],
  'hamlet-butterbill-cafe-east-table': [30,0],
  'hamlet-butterbill-cafe-east-front-chair': [30,0],
  'hamlet-clovercrust-lamp-southwest': [60,0],
};

export function homePathProp(p) {
  let q=p;
  if(SOLIDS.has(p.id)&&!p.footprint) {
    const w=p.width*(p.scale??1),rock=String(p.id).startsWith('review-coast-rock-');
    q={...p,footprint:{x:p.x,y:p.y-8,rx:w*(rock?.4:.3),ry:rock?18:w*.12}};
  }
  const move=MOVES[p.id];
  if(!move)return q;
  const [dx,dy]=move,footprint=q.footprint;
  return {...q,x:q.x+dx,y:q.y+dy,...(q.z===undefined?{}:{z:q.z+dy}),
    footprint:footprint?.poly?{...footprint,poly:footprint.poly.map(([x,y])=>[x+dx,y+dy])}
      :footprint?{...footprint,x:footprint.x+dx,y:footprint.y+dy}:undefined};
}
