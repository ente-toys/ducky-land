import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { THREE,group,mat } from './primitives.js';
const sources=import.meta.glob('../../../assets/icons/*.svg',{query:'?raw',import:'default',eager:true});
const loader=new SVGLoader();
export const iconsFactories=Object.fromEntries(Object.entries(sources).map(([path,svg])=>[path.split('/').pop().replace('.svg',''),()=>{
const g=group();const data=loader.parse(svg);let layer=0;for(const p of data.paths){if(p.userData.style.fill==='none')continue;for(const shape of p.toShapes()){const geometry=new THREE.ExtrudeGeometry(shape,{depth:8,bevelEnabled:false,curveSegments:8});const material=mat(p.color.getHex(),{side:THREE.DoubleSide});const m=new THREE.Mesh(geometry,material);m.position.z=layer*.3;g.add(m);}layer++;}
g.scale.y=-1;g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g),center=bounds.getCenter(new THREE.Vector3());g.position.set(-center.x,-bounds.min.y,0);const root=group();root.add(g);return root;
}]));
