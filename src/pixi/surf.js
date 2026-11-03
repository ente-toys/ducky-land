import {Graphics} from 'pixi.js';

// The southeastern stretch of the "Sandy coast" path in ground.svg.
const shore = [
  [[5180.5,1642.85], [5251.21,1839.50], [5411.65,2032.70], [5428.9,2232.8], .55, 1],
  [[5428.9,2232.8], [5446.15,2432.90], [5365.08,2677.85], [5284,2843.45], 0, 1],
  [[5284,2843.45], [5202.92,3009.05], [5116.68,3145.33], [4942.45,3226.4], 0, 1],
  [[4942.45,3226.4], [4768.22,3307.47], [4442.20,3281.60], [4238.65,3329.9], 0, .66],
].flatMap(([a,b,c,d,start,end], segment) =>
  Array.from({length:17}, (_, i) => {
    const t = start + (end - start) * i / 16, u = 1 - t;
    const point = axis => u ** 3 * a[axis] + 3 * u*u*t*b[axis] + 3 * u*t*t*c[axis] + t ** 3 * d[axis];
    const tangent = axis => u*u*(b[axis]-a[axis]) + 2*u*t*(c[axis]-b[axis]) + t*t*(d[axis]-c[axis]);
    const dx = tangent(0), dy = tangent(1), length = Math.hypot(dx,dy);
    return {x:point(0), y:point(1), nx:dy/length, ny:-dx/length, along:segment+i/16};
  }),
);

export function createBeachSurf(layer) {
  const waves = [0, 1/3, 2/3].map(phase => {
    const crest = new Graphics({label:'Beach surf'});
    layer.addChild(crest);
    return {phase, crest};
  });
  let lastTime = -1;

  function trace(graphics, offset, age, foam) {
    let drawing = false;
    for (const point of shore) {
      // Break the fine foam into patches while the water underneath stays continuous.
      if (foam && Math.sin(point.along * 21 + age * 4) < -.28) {
        drawing = false;
        continue;
      }
      const ripple = Math.sin(point.along * 10 - age * 3) * 5;
      const distance = offset + ripple + (foam ? 0 : 7);
      const x = point.x + point.nx * distance;
      const y = point.y + point.ny * distance;
      if (drawing) graphics.lineTo(x,y);
      else graphics.moveTo(x,y);
      drawing = true;
    }
  }

  return {
    update(time, reduced, visible) {
      const onScreen = visible(5050, 2670, 900);
      for (const {crest} of waves) crest.visible = onScreen;
      if (!onScreen) return;
      const frame = reduced ? 0 : Math.floor(time * 30);
      if (frame === lastTime) return;
      lastTime = frame;
      for (const {phase, crest} of waves) {
        const age = ((reduced ? .9 : time) / 6 + phase) % 1;
        const offset = 175 - 191 * (1 - (1 - age) ** 1.45);
        const fade = Math.min(1, age * 6, (1 - age) * 8);
        crest.clear();
        trace(crest, offset, age, false);
        crest.stroke({color:0x80cce5, width:20 + 14 * age, alpha:.36 * fade, cap:'round', join:'round'});
        trace(crest, offset, age, true);
        crest.stroke({color:0xf5ffff, width:5 + 4 * age, alpha:.9 * fade, cap:'round', join:'round'});
      }
    },
  };
}
