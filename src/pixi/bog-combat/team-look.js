import {Assets} from 'pixi.js';

// One texture bank for the whole arena. These are the original articulated
// SVG parts with only flat fills replaced, never a whole-duck sprite or tint.
let loading;
export function loadGoogleLook(){
 const urls=import.meta.glob('./assets/google-ducky/*.svg',{query:'?url',import:'default',eager:true});
 return loading??=Promise.all(Object.entries(urls).map(async([file,url])=>[file.split('/').at(-1),await Assets.load(url)])).then(entries=>{
  const textures=new Map(entries);
  return Object.freeze({body:0xEF5144,belly:0xFF9C90,textures,horn:textures.get('horn.svg'),tail:textures.get('spade-tail.svg')});
 }).catch(error=>{loading=null;throw error;});
}
