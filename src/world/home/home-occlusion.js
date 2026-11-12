import {propDepth} from './home-visibility.js';
import shapes from './home-occlusion-shapes.json' with {type:'json'};
import {isHomeGroundProp} from './home-layer.js';
export function homeOcclusionProp(p){
 if(isHomeGroundProp(p))return p;
 const spec=shapes[p.id];
 return {...p,occlusionBlockers:(spec?.polys??[]).map(poly=>({poly:poly.map(([x,y])=>[p.x+x,p.y+y]),homeOccluder:String(p.id),frontY:propDepth(p)}))};
}
