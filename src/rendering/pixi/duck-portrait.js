import {Application, Rectangle} from 'pixi.js';
import {createDuck} from './duck.js';

const slots=['cap','shades','acc','shoes'];
export const outfitKey=outfit=>outfit ? slots.map(slot=>outfit[slot]??0).join(',') : '';
export const sameOutfit=(a,b)=>Boolean(a&&b)&&slots.every(slot=>(a[slot]??0)===(b[slot]??0));
let cachedKey, cachedPortrait;
export function prepareDuckPortrait(outfit) {
  const key=outfitKey(outfit);
  if (!key) return Promise.resolve(null);
  if (key!==cachedKey) {cachedKey=key;cachedPortrait=drawPortrait({...outfit});}
  return cachedPortrait;
}

// A still picture of the player's own duck in its outfit, for the profile button and panel. Drawn once into a
// small offscreen Pixi app, read back as an image, then the app is thrown away, so nothing keeps running.

// the bare duck's height (feet to tuft), measured once, so the head crop never depends on the hat
let bareHeight;
async function duckHeight() {
  if (bareHeight) return bareHeight;
  const bare = await createDuck({outfit:{cap:0, shades:0, acc:0, shoes:0}});
  try {
    bare.update(0, {action:0, turn:0, reducedMotion:true});
    bareHeight = bare.root.getLocalBounds().height;
  } finally {bare.dispose();}
  return bareHeight;
}

async function drawPortrait(outfit) {
  const W = 640, app = new Application();
  let duck;
  try {
    // Draw once at 3x for the profile panel, without starting a second ticker.
    await app.init({width:W, height:W, backgroundAlpha:0, antialias:true, resolution:3,
      autoDensity:false, preference:'webgl', autoStart:false, sharedTicker:false});
    const height = await duckHeight();
    duck = await createDuck({outfit});
    const feet = W * .9;
    duck.root.position.set(W / 2, feet);
    duck.update(0, {action:0, turn:0, reducedMotion:true});
    app.stage.addChild(duck.root);
    app.render();
    // a profile picture: the head and face, with the whole hat. The frame runs from the hat's tip (or the
    // tuft) down to just under the cheeks, so a tall hat makes the head smaller instead of cutting the face.
    const b = duck.root.getBounds(), bottom = feet - height * .28;   // down to the chest, so the name plate never covers the face
    const top = Math.min(b.y, feet - height) - height * .06, side = Math.max(bottom - top, height * .78);
    const frame = new Rectangle(W / 2 - side / 2, bottom - side, side, side);
    return await app.renderer.extract.base64({target:app.stage, frame});
  } finally {
    duck?.dispose();
    if (app.renderer) app.destroy({removeView:true, releaseGlobalResources:false}, {children:true});
    else app.stage?.destroy({children:true});
  }
}

