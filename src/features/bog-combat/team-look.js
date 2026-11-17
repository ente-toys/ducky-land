import {Assets} from 'pixi.js';

let loading;
export function loadEvilLook(){
 const urls=import.meta.glob('./assets/evil-ducky/*.svg',{query:'?url',import:'default',eager:true});
 return loading??=Promise.all(Object.entries(urls).map(async([file,url])=>[file.split('/').at(-1),await Assets.load(url)])).then(entries=>{
  const textures=new Map(entries);
  return Object.freeze({body:0xEF5144,belly:0xFF9C90,textures,horn:textures.get('horn.svg'),tail:textures.get('spade-tail.svg')});
 }).catch(error=>{loading=null;throw error;});
}

// Karma uses the original yellow walking textures, including full wing outlines.
const karmaLook=Object.freeze({textures:new Map(),outfit:Object.freeze({shades:6})});
export function loadKarmaLook(){return Promise.resolve(karmaLook);}
