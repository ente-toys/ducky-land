import {Texture,TextureSource} from 'pixi.js';
// A decoded test texture must own a source. Texture.EMPTY intentionally fails
// the live art readiness contract and exercises the 30-second fallback path.
export const readyTexture = () => new Texture({source:new TextureSource({width:2,height:2})});
