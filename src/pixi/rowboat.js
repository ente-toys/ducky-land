import {Container, Graphics} from 'pixi.js';
import {PALETTE} from './palette.js';

const ink = 0x232323;   // the rowing Ducky keeps its own colours (boss: never change the Duckies)
const {ink: worldInk, wood, darkWood, cream} = PALETTE;   // boss 3 Nov: oars and water marks in the world palette
const strokePeriod = 1.55;

export function rowboatPose(lake, time, reduced = false) {
  const phase = reduced ? 0 : time * 2 * Math.PI / strokePeriod;
  const angle = -.32 + (reduced ? 0 : time * .185 + .022 * Math.sin(phase));
  const rx = lake.rx * .25, ry = lake.ry * .48;
  return {
    x:lake.x + lake.rx * .39 + rx * Math.cos(angle),
    y:lake.y + ry * Math.sin(angle),
    heading:Math.atan2(ry * Math.cos(angle), -rx * Math.sin(angle)),
    stroke:Math.sin(phase),
    recovery:Math.max(0, -Math.cos(phase)),
    bob:reduced ? 0 : Math.sin(phase) * 2.4,
  };
}

function makeOar() {
  return new Graphics()
    .roundRect(-27,-2.5,93,5,2.5).fill(wood).stroke({color:worldInk,width:1.3})
    .moveTo(53,-2).quadraticCurveTo(62,-9,75,-8)
    .quadraticCurveTo(83,-7,83,0).quadraticCurveTo(83,7,75,8)
    .quadraticCurveTo(62,9,53,2).closePath()
    .fill(wood).stroke({color:worldInk,width:1.5})
    .moveTo(61,-3).quadraticCurveTo(69,-6,76,-5).stroke({color:darkWood,width:1.2,cap:'round'});
}

export function createRowboat(prop, lake, objects, water) {
  const root = new Container({label:'Rowing duck'});
  const deck = new Container();
  deck.y = 73;
  root.addChild(deck);
  objects.addChild(root);
  prop.sprite.position.set(0,0);
  // Depth-sort the boat as a unit. Its old world z-index would cover the rower.
  prop.sprite.zIndex = 0;

  const farOar = makeOar(), nearOar = makeOar();
  farOar.position.set(10,-101);
  nearOar.position.set(10,-67);
  const duck = new Graphics()
    .ellipse(-7,-13,28,24).fill(0xffd525).stroke({color:ink,width:2})
    .ellipse(-7,-8,20,15).fill(0xffe780)
    .moveTo(-31,-40).bezierCurveTo(-32,-55,-23,-68,-10,-68)
    .quadraticCurveTo(-12,-78,-6,-76).quadraticCurveTo(-1,-76,0,-69)
    .quadraticCurveTo(6,-77,9,-72).lineTo(8,-67)
    .bezierCurveTo(24,-65,31,-51,29,-39)
    .bezierCurveTo(25,-25,-23,-24,-31,-40).closePath()
    .fill(0xffd525).stroke({color:ink,width:2,join:'round'})
    .circle(-10,-46,2.5).circle(9,-45,2.5).fill(ink)
    .ellipse(0,-37,8,4.5).fill(0xff814a).stroke({color:ink,width:1.5});
  const wings = new Graphics();

  // The seated silhouette ends just above the hull's front lip.
  deck.addChild(farOar,prop.sprite,duck,nearOar,wings);

  const wake = Array.from({length:3}, () => {
    const ripple = new Graphics().moveTo(5,-17).quadraticCurveTo(-13,0,5,17)
      .stroke({color:cream,width:2.6,cap:'round'});
    water.addChild(ripple);
    return ripple;
  });
  const splashes = [farOar,nearOar].map(() => {
    const ripple = new Graphics().moveTo(-11,0).quadraticCurveTo(0,-4,11,0).stroke({color:cream,width:2,cap:'round'});
    water.addChild(ripple);
    return ripple;
  });

  return {
    update(time, reduced, visible) {
      const pose = rowboatPose(lake,time,reduced);
      root.visible = visible(pose.x,pose.y,180);
      if (prop.shadow) {
        prop.shadow.visible = root.visible;
        prop.shadow.position.set(pose.x,pose.y + 15);
      }
      wake.forEach(ripple => { ripple.visible = root.visible && !reduced; });
      splashes.forEach(ripple => { ripple.visible = root.visible && !reduced; });
      if (!root.visible) return;
      root.position.set(pose.x,pose.y);
      root.zIndex = pose.y + 23;
      deck.y = 73 + pose.bob;
      deck.rotation = pose.bob * .012;
      duck.position.set(-7 + pose.stroke * 4,-81);
      duck.rotation = pose.stroke * .075;
      farOar.rotation = -Math.PI/2 + pose.stroke * .54;
      nearOar.rotation = Math.PI/2 - pose.stroke * .54;
      farOar.scale.x = nearOar.scale.x = 1 - pose.recovery * .19;
      wings.clear();
      for (const oar of [farOar,nearOar]) {
        const handX = oar.x - 23 * oar.scale.x * Math.cos(oar.rotation);
        const handY = oar.y - 23 * oar.scale.x * Math.sin(oar.rotation);
        const shoulderY = oar === farOar ? -105 : -94;
        for (const [color,width] of [[ink,11],[0xf5c329,8]]) {
          wings.moveTo(duck.x+7,shoulderY).quadraticCurveTo(handX-9,handY+5,handX,handY)
            .stroke({color,width,cap:'round'});
        }
      }
      wake.forEach((ripple,i) => {
        const past = rowboatPose(lake,time - .8 - i*.42);
        const gap = 80 + 12*i;
        ripple.position.set(past.x - Math.cos(past.heading)*gap,past.y - Math.sin(past.heading)*gap);
        ripple.rotation = past.heading;
        ripple.scale.set(1+i*.18);
        ripple.alpha = .58-i*.14;
      });
      [farOar,nearOar].forEach((oar,i) => {
        const reach = 77 * oar.scale.x;
        const splash = splashes[i];
        splash.position.set(pose.x+oar.x+Math.cos(oar.rotation)*reach,
          pose.y+deck.y+oar.y+Math.sin(oar.rotation)*reach);
        splash.alpha = (1-pose.recovery) * .7;
      });
    },
  };
}
