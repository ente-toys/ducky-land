export function retainDetailArt(game,mapId=null){
  const wanted=new Set(['home']);if(mapId)wanted.add(mapId);
  game.wantedArts=wanted;
  for(const [id,art]of game.arts??[])if(art.ready&&!wanted.has(id))game.freeArt(id);
  return wanted;
}
