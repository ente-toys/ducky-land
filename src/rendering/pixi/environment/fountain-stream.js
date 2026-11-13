import {Container, Graphics, Mesh, MeshGeometry, Texture} from 'pixi.js';

const STEPS = 12, RING_STEPS = 64;

function dynamicMesh(parent, count, indices) {
  const positions = new Float32Array(count * 2);
  const geometry = new MeshGeometry({positions, uvs: new Float32Array(count * 2), indices: new Uint16Array(indices)});
  geometry.batchMode = 'batch';
  const mesh = new Mesh({geometry, texture: Texture.WHITE});
  parent.addChild(mesh);
  mesh.once('destroyed', () => geometry.destroy(true));
  return {mesh, positions, upload() {geometry.getBuffer('aPosition').update();}};
}

// The ribbon is a strip with a sampled mouth and landing. Its topology never
// changes, so movement only uploads positions instead of rebuilding Pixi paths
// and triangulating them on every animation frame.
function ribbon(parent) {
  const indices = [];
  // Sample both directions: a fan can overlap at the curved Home fountain lip.
  const stride = STEPS + 1;
  for (let row = 0; row < STEPS; row++) for (let col = 0; col < STEPS; col++) {
    const a = row * stride + col, b = a + stride;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const shape = dynamicMesh(parent, stride * stride, indices), point = {x: 0, y: 0};
  return {...shape, update(curve, from, to, width, color, alpha, sample) {
    let n = 0;
    for (let row = 0; row <= STEPS; row++) for (let col = 0; col <= STEPS; col++) {
      sample(curve, from + (to - from) * row / STEPS, -1 + 2 * col / STEPS, width, point);
      shape.positions[n++] = point.x; shape.positions[n++] = point.y;
    }
    shape.mesh.tint = color; shape.mesh.alpha = alpha; shape.upload();
  }};
}

function ring(parent) {
  const indices = [];
  for (let i = 0; i < RING_STEPS; i++) {
    const a = i * 2, b = ((i + 1) % RING_STEPS) * 2;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const shape = dynamicMesh(parent, RING_STEPS * 2, indices);
  return {...shape, update(x, y, rx, ry, width, color, alpha) {
    for (let i = 0; i < RING_STEPS; i++) {
      const a = i * Math.PI * 2 / RING_STEPS, c = Math.cos(a), s = Math.sin(a);
      // Offset along the ellipse normal to preserve a constant stroke width.
      const length = Math.hypot(ry * c, rx * s), nx = ry * c / length * width / 2, ny = rx * s / length * width / 2;
      const p = i * 4;
      shape.positions[p] = x + rx * c - nx; shape.positions[p + 1] = y + ry * s - ny;
      shape.positions[p + 2] = x + rx * c + nx; shape.positions[p + 3] = y + ry * s + ny;
    }
    shape.mesh.tint = color; shape.mesh.alpha = alpha; shape.upload();
  }};
}

export function createFountainStream(parent, jet) {
  const root = new Container({label: 'Reusable fountain stream'}); parent.addChild(root);
  const ribbons = Array.from({length: jet ? 6 : 5}, () => ribbon(root));
  // Unit circles retain their tessellation; foam only changes transform/alpha.
  const foam = Array.from({length: 6}, () => {
    const g = new Graphics().circle(0, 0, 5).fill(0xffffff); root.addChild(g); return g;
  });
  const rings = Array.from({length: 3}, () => ring(root));
  return {root, ribbons, foam, rings};
}
