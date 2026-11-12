import {readFileSync} from 'node:fs';
import {geometry} from './assets/world/island-geometry.mjs';
export const world=JSON.parse(readFileSync(new URL('./assets/world/world.json',import.meta.url)));
export const {walkable}=geometry(world);
export const W=world.width,H=world.height,SLOTS=16,SPEED=245,HZ=12;
export const CITIES=['Kochi','Chennai','Bengaluru','London','Mumbai','Delhi','Hyderabad','Pune','Other'];
export const NAMES=['miso','pip','nori','sunny','mo','lulu','boba','waddles','bread_boy','mango'];
export const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
export function randomSpot(){// the plaza has its own social crowd, so wanderers spread wide around the other zones
 const zones=Object.entries(world.zones).filter(([n])=>n!=='plaza').map(([,z])=>z);for(let i=0;i<1000;i++){const z=pick(zones),x=z.spawn[0]+rnd(-620,620),y=z.spawn[1]+rnd(-420,420);if(walkable(x,y))return[x,y];}return world.zones.plaza.spawn;}
export function outfit(){return{cap:1+Math.floor(Math.random()*13),shades:Math.random()<.4?1+Math.floor(Math.random()*3):0,acc:Math.random()<.4?1+Math.floor(Math.random()*7):0,shoes:1+Math.floor(Math.random()*10)};}
export function move(d,vx,vy,dt,speed=SPEED){const l=Math.hypot(vx,vy);if(!l)return false;const x=d.x+vx/l*speed*dt,y=d.y+vy/l*speed*dt,ox=d.x,oy=d.y;if(walkable(x,y)){d.x=x;d.y=y;}else if(walkable(x,d.y))d.x=x;else if(walkable(d.x,y))d.y=y;if(vx)d.facing=vx<0?-1:1;d.turn=Math.atan2(vx,vy)*180/Math.PI;return ox!==d.x||oy!==d.y;}
