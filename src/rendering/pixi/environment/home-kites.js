import {Container, Graphics, Sprite} from 'pixi.js';
import sites from './home-kites.json' with {type:'json'};
export {default as HOME_KITES} from './home-kites.json' with {type:'json'};
export const KITE_COLOURS = ['red', 'yellow', 'blue', 'purple', 'mint', 'orange'];
const DIR = '/pixi-art/home-kites/';
export const KITE_ASSETS = [DIR + 'stake.svg', ...KITE_COLOURS.flatMap(c => ['body', 'tail-a', 'tail-b'].map(p => `${DIR}${c}-${p}.svg`))];
export function kiteArtEntries(siteList=sites,resolution=2){
  return KITE_ASSETS.map(src=>{
    const stake=src.endsWith('/stake.svg'),body=src.endsWith('-body.svg'),tailA=src.endsWith('-tail-a.svg');
    const colour=src.slice(DIR.length).split('-')[0];
    const scale=stake?1:Math.max(.01,...siteList.filter(s=>s.colour===colour).map(s=>s.size));
    return {src,width:stake?38:body?112:tailA?88:94,height:stake?34:body?120:tailA?82:62,scale,resolution};
  });
}

export function kitePose(site, seconds, reduced, pose) {
  const phase = seconds * Math.PI * 2 / site.period + site.phase;
  pose.x = site.lean + (reduced ? 0 : Math.sin(phase) * 13);
  pose.y = -site.height + (reduced ? 0 : Math.sin(phase * 1.31 + .7) * 6);
  pose.rotation = -.06 + (reduced ? 0 : Math.sin(phase + .4) * .045);
  pose.tailA = reduced ? 0 : Math.sin(seconds * 2.3 + site.phase) * .065;
  pose.tailB = reduced ? 0 : Math.sin(seconds * 2.7 + site.phase + 1.4) * .08;
  return pose;
}

export function createHomeKites(parent, textures, siteList = sites) {
  const entries = siteList.map(site => {
    const root = new Container({label: site.id, eventMode: 'none'});
    root.position.set(site.x, site.y); root.zIndex = site.y; root.standing = true;
    const string = new Graphics().moveTo(0, 0).quadraticCurveTo(74, -65, 100, -200).stroke({color: 0x39472d, width: 1.8});
    string.y = -17;
    const stake = new Sprite(textures[DIR + 'stake.svg']);
    stake.anchor.set(18.5 / 38, 26 / 34); stake.width = 38; stake.height = 34;
    const flying = new Container(); flying.scale.set(site.size);
    const tailA = new Sprite(textures[`${DIR}${site.colour}-tail-a.svg`]); tailA.anchor.set(2 / 88, 2 / 82); tailA.width = 88; tailA.height = 82;
    const tailB = new Sprite(textures[`${DIR}${site.colour}-tail-b.svg`]); tailB.anchor.set(2 / 94, 2 / 62); tailB.width = 94; tailB.height = 62;
    const body = new Sprite(textures[`${DIR}${site.colour}-body.svg`]); body.anchor.set(34 / 112, 112 / 120); body.width = 112; body.height = 120;
    flying.addChild(tailA, tailB, body); root.addChild(string, stake, flying); parent.addChild(root);
    return {site, root, string, flying, tailA, tailB, pose: {x: 0, y: 0, rotation: 0, tailA: 0, tailB: 0}};
  });
  function update(seconds, reduced, visible, shown = true) {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i], s = e.site;
      e.root.visible = shown && visible(s.x, s.y, s.height + 160);
      if (!e.root.visible) continue;
      const p = kitePose(s, seconds, reduced, e.pose);
      e.flying.position.set(p.x, p.y); e.flying.rotation = p.rotation;
      e.tailA.rotation = p.tailA; e.tailB.rotation = p.tailB;
      e.string.scale.set(p.x / 100, (-p.y - 17) / 200);
    }
  }
  update(0, true, () => true);
  return {entries, update};
}
