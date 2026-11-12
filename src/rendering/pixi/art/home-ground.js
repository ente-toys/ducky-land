import expansion from '../../../world/home/home-expansion.json' with {type:'json'};
import {createRasterLoader} from './theme-art-stream.js';
import {Container,Graphics,Sprite} from 'pixi.js';
import {prepareHomeGround,rasterizeHomeGround} from './home-ground-raster.js';

const HOME_GROUND_TILE_SIZE = 128;
const HOME_GROUND_GUTTER = 1;
export function homeGroundTiles(sources, size = HOME_GROUND_TILE_SIZE) {
  const {origin,width,height}=expansion,tiles=[],pad=HOME_GROUND_GUTTER;
  for(let y=0;y<height;y+=size)for(let x=0;x<width;x+=size){
    const w=Math.min(size,width-x),h=Math.min(size,height-y);
    tiles.push({src:sources[0].src+'?rasterCrop='+[width,height,x-pad,y-pad,w+2*pad,h+2*pad].join(','),
      x:origin.x+x,y:origin.y+y,width:w,height:h,pixelWidth:w+2*pad,pixelHeight:h+2*pad,
      screenResolution:true,resolution:4,viewMargin:0,prefetchMargin:256,priority:-1});
  }
  return tiles;
}

export function createHomeGroundFallback(texture,stream){
  const root=new Container({label:'Home missing ground fallback'});
  const sprite=new Sprite(texture),mask=new Graphics({label:'Home missing crop mask'});
  sprite.position.set(expansion.origin.x,expansion.origin.y);
  sprite.width=expansion.width;sprite.height=expansion.height;
  root.addChild(sprite,mask);sprite.mask=mask;
  let version=-1,rects=[];
  function update(){
    if(version===stream.residencyVersion)return false;
    version=stream.residencyVersion;rects=[];
    let run;
    for(const t of stream.entries){
      if(t.sprite.visible){run=undefined;continue;}
      if(run&&run.y===t.y&&run.height===t.height&&Math.abs(run.x+run.width-t.x)<.001)run.width+=t.width;
      else {run={x:t.x,y:t.y,width:t.width,height:t.height};rects.push(run);}
    }
    mask.clear();
    for(const r of rects)mask.rect(r.x,r.y,r.width,r.height);
    if(rects.length)mask.fill(0xffffff);
    sprite.visible=rects.length>0;
    return true;
  }
  update();
  return {root,sprite,mask,update,get rects(){return rects;}};
}

export function createHomeGroundLoader(options={}){
  const loader=createRasterLoader({concurrency:8,frameBudgetMs:2,...options,
    prepareSource:prepareHomeGround,rasterize:rasterizeHomeGround});
  return {...loader,async acquire(key,resolution,order){
    const texture=await loader.acquire(key,resolution,order);
    const crop=new URL(key,'https://home.invalid').searchParams.get('rasterCrop').split(',').map(Number);
    texture.noFrame=false;
    texture.frame.x=texture.frame.y=HOME_GROUND_GUTTER;
    texture.frame.width=crop[4]-2*HOME_GROUND_GUTTER;
    texture.frame.height=crop[5]-2*HOME_GROUND_GUTTER;
    texture.updateUvs();
    return texture;
  }};
}
