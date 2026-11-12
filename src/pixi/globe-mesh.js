import {Quaternion,Vector2,Vector3} from './globe-math.js';

export class Group {
  children=[];
  position=new Vector3();
  quaternion=new Quaternion();
  rotation={y:0};
  scale=Object.assign(new Vector3(1,1,1),{setScalar(value){return this.set(value,value,value);}});
  visible=true;
  renderOrder=0;
  add(...nodes){
    for(const node of nodes){node.removeFromParent();this.children.push(node);node.parent=this;}
  }
  remove(node){
    const index=this.children.indexOf(node);
    if(index>=0){this.children.splice(index,1);node.parent=null;}
  }
  removeFromParent(){this.parent?.remove(this);}
  traverse(visit){visit(this);for(const child of this.children)child.traverse(visit);}
}
export class Scene extends Group {}

class GpuResource extends EventTarget {
  dispose(){this.dispatchEvent(new Event('dispose'));}
}

export class Float32BufferAttribute {
  constructor(values,itemSize){this.array=new Float32Array(values);this.itemSize=itemSize;this.count=this.array.length/itemSize;}
  getX(i){return this.array[i*this.itemSize];}
  getY(i){return this.array[i*this.itemSize+1];}
  getZ(i){return this.array[i*this.itemSize+2];}
  setXY(i,x,y){const a=i*this.itemSize;this.array[a]=x;this.array[a+1]=y;}
  setXYZ(i,x,y,z){this.setXY(i,x,y);this.array[i*this.itemSize+2]=z;}
}

export class BufferGeometry extends GpuResource {
  attributes={};
  setAttribute(name,attribute){this.attributes[name]=attribute;return this;}
  translate(x,y,z){
    const p=this.attributes.position;
    for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)+x,p.getY(i)+y,p.getZ(i)+z);
  }
}

export class PlaneGeometry extends BufferGeometry {
  constructor(width,height,columns=1,rows=1){
    super();
    const positions=[],uvs=[],indices=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
      positions.push((x/columns-.5)*width,(.5-y/rows)*height,0);
      uvs.push(x/columns,1-y/rows);
      if(x<columns&&y<rows){
        const top=y*(columns+1)+x,bottom=top+columns+1;
        indices.push(top,bottom,top+1,bottom,bottom+1,top+1);
      }
    }
    this.setAttribute('position',new Float32BufferAttribute(positions,3));
    this.setAttribute('uv',new Float32BufferAttribute(uvs,2));
    this.indices=new Uint16Array(indices);
  }
}

export class SphereGeometry extends BufferGeometry {
  constructor(radius,columns,rows){
    super();
    const positions=[],normals=[],uvs=[],indices=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
      const phi=x/columns*2*Math.PI,theta=y/rows*Math.PI;
      const nx=-Math.cos(phi)*Math.sin(theta),ny=Math.cos(theta),nz=Math.sin(phi)*Math.sin(theta);
      positions.push(nx*radius,ny*radius,nz*radius);normals.push(nx,ny,nz);uvs.push(x/columns,1-y/rows);
      if(x<columns&&y<rows){
        const top=y*(columns+1)+x,bottom=top+columns+1;
        if(y!==0)indices.push(top+1,top,bottom+1);
        if(y!==rows-1)indices.push(top,bottom,bottom+1);
      }
    }
    this.setAttribute('position',new Float32BufferAttribute(positions,3));
    this.setAttribute('normal',new Float32BufferAttribute(normals,3));
    this.setAttribute('uv',new Float32BufferAttribute(uvs,2));
    this.indices=new Uint16Array(indices);
  }
}

export class Matrix3 {
  elements=new Float32Array([1,0,0,0,1,0,0,0,1]);
  set(a,b,c,d,e,f,g,h,i){this.elements.set([a,d,g,b,e,h,c,f,i]);return this;}
  copy(m){this.elements.set(m.elements);return this;}
}
export const SRGBColorSpace='srgb';
export const RepeatWrapping='repeat';
export const LinearFilter='linear';
export class CanvasTexture extends GpuResource {
  matrix=new Matrix3();
  version=1;
  generateMipmaps=true;
  constructor(image){super();this.image=image;}
  set needsUpdate(value){if(value)this.version++;}
}
export class TextureLoader {
  load(url){
    const image=new Image(),texture=new CanvasTexture(image);
    image.src=url;
    return texture;
  }
  async loadAsync(url){const texture=this.load(url);await texture.image.decode();return texture;}
}

export class MeshBasicMaterial extends GpuResource {
  opacity=1;
  depthTest=true;
  depthWrite=true;
  userData={};
  constructor(options={}){super();Object.assign(this,options);}
}
export class ShaderMaterial extends MeshBasicMaterial {}
export class LineBasicMaterial extends MeshBasicMaterial {}
export class SpriteMaterial extends MeshBasicMaterial {}

export class Mesh extends Group {
  userData={};
  constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
export class LineSegments extends Mesh {}
const spritePlane=new PlaneGeometry(1,1);
export class Sprite extends Mesh {
  center=new Vector2(.5,.5);
  constructor(material){super(spritePlane,material);}
}

export class Color {
  constructor(hex){
    const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
    this.r=linear((hex>>16&255)/255);
    this.g=linear((hex>>8&255)/255);
    this.b=linear((hex&255)/255);
  }
}
