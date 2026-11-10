// Bellovo centre, hand-composed in the upright Home camera. All units are world units.
export const CATHEDRAL={x:4020,y:1920,width:1120,height:1180};
export const TOWER={x:4500,y:1790,width:320,height:1190};
export const PIAZZA={x:4100,y:2490,rx:1160,ry:850};
// Shared pier stations around the inner edge, north to south. Straight bays
// join these stations as a polygon. The three camera variants are drawn in SVG.
export const LEFT=[[3580,1835],[3300,1895],[3170,1995],[3100,2135],[2870,2300],[2825,2475],[2845,2615]];
export const RIGHT=LEFT.map(([x,y])=>[8200-x,y]);
export const OLD_CENTRE_IDS=new Set(['cathedral-hall','campanile','cathedral-2','cathedral-3']);
export const RETIRED_CENTRE=id=>OLD_CENTRE_IDS.has(id)||/^cloister-(cloister-back|roof-roses)/.test(id)||/^centre-(colonnade|hall|tower)/.test(id);
export const isOldCentreSolid=o=>
 o.id?.startsWith('centre-') ||
 (!o.id && !o.poly && ((o.x===4800&&o.y===1530)||(o.rx===22&&o.ry===22&&[1724,1664].includes(o.y)))) ||
 (o.poly?.length===4&&o.poly[0][0]===3570&&o.poly[0][1]===1430);
