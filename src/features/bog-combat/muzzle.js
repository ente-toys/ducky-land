import guns from './assets/guns.json' with {type:'json'};

export const heldAimFacing=facing=>Math.atan2(Math.sin(facing),Math.cos(facing)*.5);
export const holdingWingTilt=spec=>{
  const side=Math.abs(spec.rigAngle),degrees=side===90?50:side===0||side===180?20:35;
  return Math.sign(spec.wingPose.rotationDegrees)*degrees*Math.PI/180;
};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Server bots use the same eight held-weapon drawings. Human clients supply the
// current animated barrel offset, bounded and checked against cover by the authority.
export function botMuzzleOffset(facing,team,out={}){
  const choices=guns.filter(g=>g.team===team);
  const spec=choices.reduce((best,g)=>Math.abs(wrap(g.rigAngle*Math.PI/180-facing))<Math.abs(wrap(best.rigAngle*Math.PI/180-facing))?g:best);
  const aim=heldAimFacing(facing),barrel=Math.atan2(Math.cos(aim),Math.sin(aim));
  const rotation=wrap(barrel-Math.atan2(spec.aimScreenVector[1],spec.aimScreenVector[0]));
  const wing=holdingWingTilt(spec);
  const dx=spec.wingPose.contactRest[0]-spec.wingPose.pivot[0],dy=spec.wingPose.contactRest[1]-spec.wingPose.pivot[1];
  const gx=spec.wingPose.pivot[0]+dx*Math.cos(wing)-dy*Math.sin(wing);
  const gy=spec.wingPose.pivot[1]+dx*Math.sin(wing)+dy*Math.cos(wing);
  const mx=spec.muzzle[0]-spec.grip[0],my=spec.muzzle[1]-spec.grip[1],scale=.88*.24;
  out.x=(gx+mx*Math.cos(rotation)-my*Math.sin(rotation))*scale;
  out.y=(gy+mx*Math.sin(rotation)+my*Math.cos(rotation)+12)*scale+34;
  return out;
}
