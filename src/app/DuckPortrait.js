import {useEffect, useState} from 'react';
import {Application, Rectangle} from 'pixi.js';
import {createDuck} from '../rendering/pixi/duck.js';

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
  // drawn at 3x so the portrait stays crisp in the big panel circle on retina screens
  await app.init({width:W, height:W, backgroundAlpha:0, antialias:true, resolution:3, autoDensity:false, preference:'webgl'});
  const height = await duckHeight();
  const duck = await createDuck({outfit});
  try {
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
    duck.dispose();
    app.destroy({removeView:true, releaseGlobalResources:false}, {children:true});
  }
}

export function useDuckPortrait(outfit) {
  const [src, setSrc] = useState(null);
  const key = outfit ? JSON.stringify(outfit) : '';
  useEffect(() => {
    if (!key) return;
    let live = true;
    drawPortrait(JSON.parse(key)).then(url => {if (live) setSrc(url);}).catch(() => {});
    return () => {live = false;};
  }, [key]);
  return src;
}
