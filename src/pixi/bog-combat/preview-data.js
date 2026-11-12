import {mapOf} from '../island-maps.js';
export const map=mapOf('home');
export const navigation=map.nav();
export const pads=team=>team==='privacy'?[{x:2750,y:2600,base:'home-test-privacy'}]:[{x:3070,y:2600,base:'home-test-google'}];
export const bounds={x0:map.world.origin?.x??0,y0:map.world.origin?.y??0,width:map.width,height:map.height};
