// Little-endian GND1: 16-byte header, padded JSON metadata, then packed
// Layout 4 stores shared quantized geometry as delta varints, plus affine
// instances. The worker expands Float32 XY, Uint8 RGBA and Uint32 indices.
export function decodeGroundMesh(buffer,{expand=true}={}){
 const head=new DataView(buffer);
 if(head.byteLength<16||head.getUint32(0,true)!==0x31444e47)throw Error('Invalid ground mesh');
 const size=head.getUint32(4,true),vertices=head.getUint32(8,true),count=head.getUint32(12,true),offset=16+size;
 if(size%4||offset>buffer.byteLength)throw Error('Invalid ground mesh lengths');
 const metadata=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,16,size)).trim());
 if(metadata.version!==1)throw Error('Unsupported ground mesh version');
 const positionBytes=metadata.positionBytes??vertices*8;if(offset+positionBytes+vertices*4+(metadata.indexBytes??count*4)!==buffer.byteLength)throw Error('Invalid ground mesh lengths');
 const varint=cursor=>{let value=0,shift=0,byte;do{if(cursor.at>=buffer.byteLength||shift>28)throw Error('Invalid ground varint');byte=head.getUint8(cursor.at++);value|=(byte&127)<<shift;shift+=7;}while(byte&128);return value>>>0;};
 const indexOffset=offset+positionBytes+vertices*4;
 let indices;if(metadata.indexEncoding==='delta-varint'){indices=new Uint32Array(count);let previous=0,cursor={at:indexOffset};for(let i=0;i<count;i++){const v=varint(cursor);previous+=(v>>>1)^-(v&1);indices[i]=previous;}}
 else {indices=new Uint32Array(buffer,indexOffset,count);if(metadata.indexEncoding==='delta-zigzag'){const decoded=new Uint32Array(count);let previous=0;for(let i=0;i<count;i++){const v=indices[i];previous+=(v>>>1)^-(v&1);decoded[i]=previous;}indices=decoded;}}
 let positions=metadata.layout===4?new Float32Array(vertices*2):new Float32Array(buffer,offset,vertices*2),colors=new Uint8Array(buffer,offset+positionBytes,vertices*4);
 if(metadata.layout===4){for(const [vertex,n,,,at,quant]of metadata.motifs){const cursor={at:offset+at},previous=[0,0];for(let j=0;j<n*2;j++){if(metadata.positionEncoding==='delta-varint'){const v=varint(cursor);previous[j%2]+=(v>>>1)^-(v&1);positions[vertex*2+j]=previous[j%2]/quant;}else positions[vertex*2+j]=quant?head.getUint16(offset+at+j*2,true)/quant:head.getFloat32(offset+at+j*4,true);}}}

 let uv;
 if(expand&&[2,3,4].includes(metadata.layout)){
  let nv=0,ni=0;for(const instance of metadata.instances){const m=metadata.motifs[instance[0]];nv+=m[1];ni+=m[3];}
  uv=new Float32Array(nv*2).fill(.5);
  const xy=new Float32Array(nv*2),rgba=new Uint8Array(nv*4),ix=new Uint32Array(ni),records=[];let vertex=0,index=0;
  for(const [instanceIndex,instance] of metadata.instances.entries()){const [motif,x,y]=instance,[sx,sy]=metadata.layout>=3?instance.slice(3,5):[1,1],[r,g,b,a]=instance.slice(metadata.layout>=3?5:3);const [v,n,start,count]=metadata.motifs[motif];for(let j=0;j<n;j++){xy[(vertex+j)*2]=positions[(v+j)*2]*sx+x;xy[(vertex+j)*2+1]=positions[(v+j)*2+1]*sy+y;const c=(vertex+j)*4;rgba[c]=r;rgba[c+1]=g;rgba[c+2]=b;rgba[c+3]=a;if(metadata.maskUV?.[instanceIndex])uv.set(metadata.maskUV[instanceIndex].slice(j*2,j*2+2),(vertex+j)*2);}for(let j=0;j<count;j++)ix[index+j]=indices[start+j]+vertex;records.push({start:index,count,vertexStart:vertex,vertices:n});vertex+=n;index+=count;}
  positions=xy;colors=rgba;indices=ix;metadata.records=records;
 }
 return {metadata,positions,colors,indices,uv};
}
