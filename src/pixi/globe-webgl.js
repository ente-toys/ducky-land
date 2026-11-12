import {Quaternion,Vector3,transformMatrix} from './globe-math.js';
import {LineSegments,Sprite,Color,LinearFilter,RepeatWrapping,SRGBColorSpace} from './globe-mesh.js';

const vertex=`
#include <common>
void main(){
  vMapUv=(mapTransform*vec3(uv,1.)).xy;
  #include <uv_vertex>
  vec3 transformed=position;
  if(isCard){
    vec2 p=transformed.xy+vec2(.5)-cardCenter;
    transformed.xy=mat2(cos(cardRoll),sin(cardRoll),-sin(cardRoll),cos(cardRoll))*p;
  }
  #include <begin_vertex>
  #include <project_vertex>
}`;
const fragment=`
#include <common>
void main(){
  #include <clipping_planes_fragment>
  vec4 diffuseColor=vec4(baseColor,materialOpacity);
  #include <map_fragment>
  if(diffuseColor.a<alphaTest)discard;
  vec3 outgoingLight=diffuseColor.rgb;
  #include <opaque_fragment>
  gl_FragColor=vec4(outgoingLight,diffuseColor.a);
  #include <colorspace_fragment>
}`;
const vertexHeader=`#version 300 es
precision highp float;
#define varying out
#define USE_MAP
layout(location=0) in vec3 position;
layout(location=1) in vec2 uv;
layout(location=2) in vec3 normal;
uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix;
uniform mat3 normalMatrix,mapTransform;
uniform vec2 cardCenter;
uniform float cardRoll;
uniform bool isCard;
varying vec2 vMapUv;
`;
const fragmentHeader=`#version 300 es
precision highp float;
#define varying in
#define texture2D texture
#define gl_FragColor outputColor
out vec4 outputColor;
varying vec2 vMapUv;
uniform vec3 cameraPosition,baseColor;
uniform sampler2D map;
uniform float materialOpacity,alphaTest;
uniform bool hasMap;
vec3 toSRGB(vec3 c){
  return mix(12.92*c,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c));
}
`;
const chunks={
  project_vertex:'gl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.);',
  map_fragment:'if(hasMap)diffuseColor*=texture(map,vMapUv);',
  colorspace_fragment:'gl_FragColor.rgb=toSRGB(gl_FragColor.rgb);'
};
const expand=source=>source.replace(/#include <(\w+)>/g,(_,key)=>chunks[key]??'');
const identityUV=new Float32Array([1,0,0,0,1,0,0,0,1]);
const origin=new Vector3(),unitScale=new Vector3(1,1,1),yAxis=new Vector3(0,1,0);
const white=new Color(0xffffff);

function link(gl,vert,frag){
  const compile=(type,source)=>{
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      const message=gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw Error('Globe shader: '+message);
    }
    return shader;
  };
  const vs=compile(gl.VERTEX_SHADER,vert);
  const program=gl.createProgram();
  try{
    const fs=compile(gl.FRAGMENT_SHADER,frag);
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(fs);
  }catch(error){
    gl.deleteProgram(program);
    throw error;
  }finally{
    gl.deleteShader(vs);
  }
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
    const message=gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw Error('Globe shader link: '+message);
  }
  const uniforms=new Map();
  for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){
    const {name,type}=gl.getActiveUniform(program,i);
    uniforms.set(name,{location:gl.getUniformLocation(program,name),type});
  }
  return {program,uniforms};
}

export class WebGLRenderer {
  constructor(){
    this.domElement=document.createElement('canvas');
    this.gl=this.domElement.getContext('webgl2',{antialias:true,alpha:true});
    if(!this.gl)throw Error('The globe requires WebGL 2.');
    this.width=this.height=this.dpr=1;
    this.info={render:{calls:0}};
    this.programs=new Map();
    this.geometries=new Map();
    this.textures=new Map();
    this.initialize();
    this.onContextLost=event=>{event.preventDefault();this.releaseResources();};
    this.onContextRestored=()=>this.initialize();
    this.domElement.addEventListener('webglcontextlost',this.onContextLost);
    this.domElement.addEventListener('webglcontextrestored',this.onContextRestored);
  }
  initialize(){
    const gl=this.gl;
    this.materials=new WeakMap();
    this.anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');
    const max=this.anisotropy?gl.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT):1;
    this.capabilities={getMaxAnisotropy:()=>max};
    this.empty=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,this.empty);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.cullFace(gl.BACK);
    gl.depthFunc(gl.LEQUAL);
  }
  setSize(width,height){
    if(this.width===width&&this.height===height)return;
    this.width=width;this.height=height;this.resizeCanvas();
  }
  setPixelRatio(dpr){
    if(this.dpr===dpr)return;
    this.dpr=dpr;this.resizeCanvas();
  }
  resizeCanvas(){
    const c=this.domElement;
    c.width=Math.floor(this.width*this.dpr);c.height=Math.floor(this.height*this.dpr);
    c.style.width=this.width+'px';c.style.height=this.height+'px';
  }
  prepareMaterial(material){
    let result=this.materials.get(material);
    if(result)return result;
    const shader={uniforms:{...material.uniforms},vertexShader:material.vertexShader??vertex,fragmentShader:material.fragmentShader??fragment};
    material.onBeforeCompile?.(shader);
    const vert=vertexHeader+expand(shader.vertexShader),frag=fragmentHeader+expand(shader.fragmentShader);
    const key=vert+'\n'+frag;
    let program=this.programs.get(key);
    if(!program){program=link(this.gl,vert,frag);this.programs.set(key,program);}
    result={...program,values:shader.uniforms};
    this.materials.set(material,result);
    return result;
  }
  async compileAsync(scene){
    if(this.gl.isContextLost())return;
    scene.traverse(node=>{if(node.material)this.prepareMaterial(node.material);});
  }
  uploadGeometry(geometry){
    let data=this.geometries.get(geometry);
    if(data)return data;
    const gl=this.gl,vao=gl.createVertexArray(),buffers=[];
    gl.bindVertexArray(vao);
    for(const [location,name] of ['position','uv','normal'].entries()){
      const attribute=geometry.attributes[name];
      if(!attribute)continue;
      const buffer=gl.createBuffer();buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,attribute.array,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,attribute.itemSize,gl.FLOAT,false,0,0);
    }
    if(geometry.indices){
      const buffer=gl.createBuffer();buffers.push(buffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,geometry.indices,gl.STATIC_DRAW);
    }
    const release=()=>{
      this.geometries.delete(geometry);
      gl.deleteVertexArray(vao);
      for(const buffer of buffers)gl.deleteBuffer(buffer);
      geometry.removeEventListener('dispose',release);
    };
    geometry.addEventListener('dispose',release);
    data={vao,release,count:geometry.indices?.length??geometry.attributes.position.count};
    this.geometries.set(geometry,data);
    return data;
  }
  uploadTexture(texture){
    if(!texture?.image?.width||!texture.image.height)return this.empty;
    const gl=this.gl;
    let data=this.textures.get(texture);
    if(!data){
      const handle=gl.createTexture(),release=()=>{
        this.textures.delete(texture);
        gl.deleteTexture(handle);
        texture.removeEventListener('dispose',release);
      };
      data={handle,release,version:0,width:0,height:0};
      texture.addEventListener('dispose',release);
      this.textures.set(texture,data);
    }
    if(data.version!==texture.version){
      gl.bindTexture(gl.TEXTURE_2D,data.handle);
      const internal=texture.colorSpace===SRGBColorSpace?gl.SRGB8_ALPHA8:gl.RGBA8;
      const {width,height}=texture.image;
      if(data.width===width&&data.height===height){
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,texture.image);
      }else{
        gl.texImage2D(gl.TEXTURE_2D,0,internal,gl.RGBA,gl.UNSIGNED_BYTE,texture.image);
        data.width=width;data.height=height;
      }
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,texture.generateMipmaps&&texture.minFilter!==LinearFilter?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,texture.wrapS===RepeatWrapping?gl.REPEAT:gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(this.anisotropy&&texture.anisotropy)gl.texParameterf(gl.TEXTURE_2D,this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(texture.anisotropy,this.capabilities.getMaxAnisotropy()));
      if(texture.generateMipmaps)gl.generateMipmap(gl.TEXTURE_2D);
      data.version=texture.version;
    }
    return data.handle;
  }
  render(scene,camera){
    const gl=this.gl,opaque=[],transparent=[];
    this.info.render.calls=0;
    if(gl.isContextLost())return;
    const visit=(node,parentQ,parentScale,parentPosition)=>{
      if(!node.visible)return;
      const q=node.quaternion.clone();
      if(node.rotation.y)q.multiply(new Quaternion().setFromAxisAngle(yAxis,node.rotation.y));
      q.premultiply(parentQ);
      const scale=new Vector3(node.scale.x*parentScale.x,node.scale.y*parentScale.y,node.scale.z*parentScale.z);
      const position=new Vector3(node.position.x*parentScale.x,node.position.y*parentScale.y,node.position.z*parentScale.z)
        .applyQuaternion(parentQ).addScaledVector(parentPosition,1);
      if(node.material)(node.material.transparent?transparent:opaque).push({node,q,scale,position});
      for(const child of node.children)visit(child,q,scale,position);
    };
    visit(scene,new Quaternion(),unitScale,origin);
    transparent.sort((a,b)=>a.node.renderOrder-b.node.renderOrder||a.position.z-b.position.z);
    gl.viewport(0,0,this.domElement.width,this.domElement.height);
    gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const model=new Float32Array(16),modelView=new Float32Array(16),projection=new Float32Array(camera.projectionMatrix.elements);
    const inverse=camera.quaternion.clone().invert();
    for(const {node,q,scale,position} of [...opaque,...transparent]){
      const {geometry,material}=node,sprite=node instanceof Sprite;
      const {program,uniforms,values}=this.prepareMaterial(material);
      gl.useProgram(program);
      const toggle=(flag,value)=>value?gl.enable(flag):gl.disable(flag);
      toggle(gl.BLEND,material.transparent);
      toggle(gl.DEPTH_TEST,material.depthTest);
      toggle(gl.CULL_FACE,!(node instanceof LineSegments));
      gl.depthMask(material.depthWrite);
      toggle(gl.POLYGON_OFFSET_FILL,material.polygonOffset);
      if(material.polygonOffset)gl.polygonOffset(material.polygonOffsetFactor,material.polygonOffsetUnits);
      const drawQ=sprite?camera.quaternion:q,viewQ=inverse.clone().multiply(drawQ);
      transformMatrix(model,drawQ,position,scale);
      transformMatrix(modelView,viewQ,position.clone().sub(camera.position).applyQuaternion(inverse),scale);
      const normal=new Float32Array([modelView[0]/scale.x,modelView[1]/scale.x,modelView[2]/scale.x,modelView[4]/scale.y,modelView[5]/scale.y,modelView[6]/scale.y,modelView[8]/scale.z,modelView[9]/scale.z,modelView[10]/scale.z]);
      const builtIn={modelMatrix:model,modelViewMatrix:modelView,projectionMatrix:projection,normalMatrix:normal,cameraPosition:camera.position,
        mapTransform:material.map?.matrix.elements??identityUV,baseColor:material.color===undefined?white:new Color(material.color),
        map:material.map,materialOpacity:material.opacity,alphaTest:material.alphaTest??0,hasMap:!!material.map,isCard:sprite,
        cardCenter:node.center,cardRoll:material.rotation??0};
      let slot=0;
      for(const [name,{location,type}] of uniforms){
        const v=name in values?values[name].value:builtIn[name];
        switch(type){
          case gl.FLOAT: gl.uniform1f(location,v);break;
          case gl.BOOL: gl.uniform1i(location,Number(v));break;
          case gl.FLOAT_VEC2: gl.uniform2f(location,v?.x??.5,v?.y??.5);break;
          case gl.FLOAT_VEC3: gl.uniform3f(location,v.x??v.r,v.y??v.g,v.z??v.b);break;
          case gl.FLOAT_MAT3: gl.uniformMatrix3fv(location,false,v?.elements??v);break;
          case gl.FLOAT_MAT4: gl.uniformMatrix4fv(location,false,v);break;
          case gl.SAMPLER_2D:
            gl.activeTexture(gl.TEXTURE0+slot);
            gl.bindTexture(gl.TEXTURE_2D,this.uploadTexture(v));
            gl.uniform1i(location,slot++);
            break;
        }
      }
      const {vao,count}=this.uploadGeometry(geometry);
      gl.bindVertexArray(vao);
      if(geometry.indices)gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_SHORT,0);
      else gl.drawArrays(node instanceof LineSegments?gl.LINES:gl.TRIANGLES,0,count);
      this.info.render.calls++;
    }
  }
  releaseResources(){
    for(const geometry of this.geometries.values())geometry.release();
    for(const texture of this.textures.values())texture.release();
    for(const {program} of this.programs.values())this.gl.deleteProgram(program);
    this.programs.clear();
    this.gl.deleteTexture(this.empty);
  }
  dispose(){
    this.domElement.removeEventListener('webglcontextlost',this.onContextLost);
    this.domElement.removeEventListener('webglcontextrestored',this.onContextRestored);
    this.releaseResources();
  }
}
