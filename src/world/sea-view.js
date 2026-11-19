import {mapPoint} from './sphere-coordinates.js';
import {nearestSeaImage} from './flat-layout.js';
import {seaCentreY} from './rigid.js';
// Project a server pose into the viewer's local chart and nearest periodic image.
export function seaViewPose(viewer,pose,reach=Infinity){
 const p=mapPoint(pose.islandId,viewer.islandId,pose);
 const {x,y,flip}=nearestSeaImage(p.x,p.y,viewer,seaCentreY(viewer.islandId));
 if(Math.hypot(x-viewer.x,y-viewer.y)>reach)return null;
 const turn=flip<0&&Number.isFinite(pose.turn)?Math.atan2(Math.sin(pose.turn),-Math.cos(pose.turn)):pose.turn;
 return {...pose,x,y,turn};
}
