import {isHomeGroundProp} from './home-layer.js';
export const propDepth=p=>p.sortFootY??p.z??p.y;
export const homePropContainer=(p,scene)=>isHomeGroundProp(p)?scene.decks:scene.objects;
function compareHomeDepth(a,b){
 const depth=a.zIndex-b.zIndex;if(depth)return depth;
 const ar=a.homeSortRole??1,br=b.homeSortRole??1;if(ar!==br)return ar-br;
 const ai=String(a.homeSortId??a.label??a.uid),bi=String(b.homeSortId??b.label??b.uid);
 return ai<bi?-1:ai>bi?1:0;
}
export function sortHomeChildren(){if(!this.sortDirty)return;this.sortDirty=false;this.children.sort(compareHomeDepth);}
