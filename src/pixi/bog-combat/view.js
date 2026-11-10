const lerpAngle=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;
export function samplePlayerTrack(track,now,out={},seconds=.05) {
  const t=Math.max(0,Math.min(1,(now-track.start)/seconds)),{from,to}=track;
  Object.assign(out,to,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,turn:lerpAngle(from.turn??0,to.turn??0,t)});
  return out;
}
export function displayedPlayer(player,previous,alpha,offsetX,offsetY,out={}) {
  const t=Math.max(0,Math.min(1,alpha));
  Object.assign(out,player);
  out.x=(previous?previous.x+(player.x-previous.x)*t:player.x)+offsetX;
  out.y=(previous?previous.y+(player.y-previous.y)*t:player.y)+offsetY;
  out.turn=previous?lerpAngle(previous.turn??0,player.turn??0,t):player.turn;
  return out;
}
