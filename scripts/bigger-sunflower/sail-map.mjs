// Proof (boss 8 Nov, sailable rivers): every point a boat can sail on and around Sunbob, flood-filled from the harbour. Blue =
// reached from the sea, red = sailable but cut off, green = land. node scripts/bigger-sunflower/sail-map.mjs <out.png>
import sharp from 'sharp';
import {mapFor} from '../../src/pixi/island-maps.js';
import {canSail, harborOf} from '../../src/pixi/islands.js';
const m = mapFor('sunflower'), id = 'blossom', S = +(process.argv[3] ?? 20), x0 = -2400, y0 = -1800, W = 12800 / S | 0, H = 9200 / S | 0;
const ok = new Uint8Array(W * H);
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) ok[r * W + c] = canSail(x0 + c * S, y0 + r * S, id) ? 1 : 0;
const h = harborOf(id).water, start = Math.round((h.y - y0) / S) * W + Math.round((h.x - x0) / S), seen = new Uint8Array(W * H), q = [start]; seen[start] = 1;
for (let k = 0; k < q.length; k++) {const i = q[k], r = i / W | 0, c = i % W; for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {const j = (r + dr) * W + c + dc; if (r + dr < 0 || c + dc < 0 || r + dr >= H || c + dc >= W || seen[j] || !ok[j]) continue; seen[j] = 1; q.push(j);}}
const buf = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) buf.set(seen[i] ? [0, 90, 255] : ok[i] ? [255, 0, 0] : m.landAt(x0 + i % W * S, y0 + (i / W | 0) * S) ? [120, 160, 60] : [200, 230, 240], i * 3);
await sharp(buf, {raw: {width: W, height: H, channels: 3}}).png().toFile(process.argv[2] ?? 'sail-map.png');
console.log('harbour', h, 'sailable', ok.reduce((a, b) => a + b, 0), 'reached', q.length);
