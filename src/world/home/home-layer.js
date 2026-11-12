import contract from './home-prop-contract.json' with {type:'json'};
export const homePropContract=p=>p.homeContract??contract[p.src];
export const isHomeGroundProp=p=>p.groundLayer===true||homePropContract(p)?.layer==='ground';
export function homeLayerProp(p) {
 const rule=homePropContract(p);
 if(!rule)throw Error(`Unclassified Home prop ${p.id}: ${p.src}`);
 if(rule.layer==='ground'){
  const {footprint,...art}=p;
  return {...art,homeContract:rule,groundLayer:true,contact:false,noShadow:true};
 }
 const f=p.footprint;
 const sortFootY=p.sortFootY??(f?.poly?Math.max(...f.poly.map(q=>q[1])):f?f.y+f.ry:p.y);
 return {...p,homeContract:rule,sortFootY,z:sortFootY,...(rule.uprightSrc?{uprightSrc:rule.uprightSrc}:{}),...(rule.groundShadowSrc?{groundShadowSrc:rule.groundShadowSrc,noShadow:true}:{})};
}
