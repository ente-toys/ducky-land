// Exercise the real canvas renderer without a browser. DOM geometry is explicit;
// this verifies pixels and input handling, not browser CSS layout.
import {createCanvas} from '@napi-rs/canvas';
import {createStargazeSky} from '../../src/pixi/stargaze-sky.js';
export const fixture = {total:30088,me:{accountId:'1',login:'you',starred:true},online:['1','2'],friends:[],
  players:[['1','you'],['2','mallard'],['3','pekin'],['4','teal'],['5','eider'],['6','wigeon'],['7','pintail'],['8','gadwall']]};
export function harness({width=1000,height=1000,reduced=true,data=fixture} = {}) {
  const original = new Map(), scheduled = new Map(); let nextFrame = 0;
  const set = (key,value) => {original.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});};
  const window = new EventTarget(), motion = Object.assign(new EventTarget(),{matches:reduced});
  set('window',window);set('document',{hidden:false,createElement:() => createCanvas(1,1)});
  set('matchMedia',() => motion);set('devicePixelRatio',1);
  set('requestAnimationFrame',callback => {scheduled.set(++nextFrame,callback);return nextFrame;});
  set('cancelAnimationFrame',id => scheduled.delete(id));
  const lens = {style:{},classList:{add(){},remove(){}}};
  const makeTag = (textContent='') => Object.assign(new EventTarget(),{style:{},dataset:{},hidden:true,textContent,offsetWidth:104,offsetHeight:34});
  const tag = makeTag('Your star'), nameTag = makeTag();
  const canvas = createCanvas(1,1), events = new EventTarget();
  canvas.addEventListener = events.addEventListener.bind(events);canvas.removeEventListener = events.removeEventListener.bind(events);
  canvas.setPointerCapture = () => {};canvas.focus = () => {};
  canvas.getBoundingClientRect = () => ({left:0,top:0,width:canvas.width,height:canvas.height});
  const box = {width,height};
  const view = createStargazeSky({stage:{getBoundingClientRect:() => box},lens,canvas,tag,nameTag});
  const tick = (now=performance.now()+2000) => {const callbacks=[...scheduled.values()];scheduled.clear();for(const callback of callbacks)callback(now);};
  const send = (name,props={}) => {const event=new Event(name,{cancelable:true});Object.assign(event,props);events.dispatchEvent(event);tick();return event;};
  view.start();view.setData(data);tick();
  return {canvas,view,tag,nameTag,lens,tick,send,window,motion,scheduled,
    resize(w,h){box.width=w;box.height=h;window.dispatchEvent(new Event('resize'));tick();},
    pixels:() => canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,
    dispose(){view.dispose();for(const [key,descriptor] of original) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}},
  };
}
