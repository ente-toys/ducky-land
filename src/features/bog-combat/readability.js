import {Filter,GlProgram,defaultFilterVert} from 'pixi.js';

export const BOG_OUTLINE_PIXELS=3;
export const BOG_TEAM_COLOURS=Object.freeze({
  karma:Object.freeze({body:0xFFD525,ring:0xFFD525,rim:0xFFFFFF}),
  evil:Object.freeze({body:0xEF5144,ring:0xEF5144,rim:0x23182F}),
});

const fragment=`
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uInputClamp;
void main() {
  vec4 source=texture(uTexture,vTextureCoord);
  float silhouette=source.a;
  for(int i=0;i<16;i++) {
    float angle=float(i)*6.28318530718/16.0;
    vec2 offset=vec2(cos(angle),sin(angle))*${BOG_OUTLINE_PIXELS}.0*uInputSize.zw;
    silhouette=max(silhouette,texture(uTexture,clamp(vTextureCoord+offset,uInputClamp.xy,uInputClamp.zw)).a);
  }
  float border=silhouette*(1.0-source.a);
  finalColor=source+vec4(vec3(border),border);
}`;

export function createBogReadability(rig) {
  const root=rig.root,previous=root.filters;
  const outline=new Filter({
    glProgram:GlProgram.from({vertex:defaultFilterVert,fragment,name:'bog-white-sticker'}),
    padding:BOG_OUTLINE_PIXELS+1,resolution:'inherit',antialias:'inherit',
  });
  const filters=[outline];
  return {outline,update(){
    root.alpha=1;root.tint=0xFFFFFF;
    if(root.filters?.includes(outline))root.filters=null;
  },dispose(){
    if(!root.destroyed&&root.filters?.includes(outline))root.filters=previous;
    outline.destroy();
  }};
}
