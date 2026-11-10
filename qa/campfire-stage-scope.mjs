import fs from 'node:fs';
const layout=JSON.parse(fs.readFileSync(new URL('../rive/web/themes/community/stage-layout.json',import.meta.url)));
export const stageEditedIds=new Set(['events-stage',...Object.keys(layout.treeMoves),...Object.keys(layout.audienceMoves)]);
export const outsideStageProps=props=>props.filter(p=>!stageEditedIds.has(p.id));
export const clearedStageFlat=p=>{
 const width=p.width*(p.scale??1),height=p.height*(p.scale??1);
 return p.x-width/2<4410&&p.x+width/2>3590&&p.y-height<1940&&p.y>1292;
};
export const outsideStageFlats=flats=>flats.filter(p=>p.id!=='stage-approach'&&!clearedStageFlat(p));
export const outsideStageObstacles=obstacles=>obstacles.filter(o=>{
 if(o.id?.startsWith('stage-'))return false;
 if(o.poly?.length===4&&o.poly[0][0]===3618&&o.poly[0][1]===1007)return false;
 return !Object.entries(layout.treeMoves).some(([id,[x,y]])=>{
  const original={'tree-1-106':[4260,889],'tree-1-116':[3930,848],'tree-1-126':[3636,946],'polish-tree-5':[4350,990],'tree-1-128':[3431,1461]}[id],dy=id.startsWith('polish-')?-8:-9;
  return o.rx===31&&((o.x===x&&o.y===y+dy)||(o.x===original[0]&&o.y===original[1]+dy));
 });
});
