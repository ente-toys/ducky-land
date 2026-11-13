// Builds public/pixi-art/boat-build/build.svg, the one-shot "boat built" burst (0.57 s): the three gathered
// materials fly together, then four smoke frames play over them while the boat appears underneath. All art is
// inlined (an <img> SVG cannot load other files); the smoke frames live here in smoke/ as source art only.
// Run: node scripts/boat-build/build-svg.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ART = 'public/pixi-art/boat-build/';

// an SVG file as a <symbol>, its ids prefixed so several sources can share one document
function symbol(id, path) {
  const svg = readFileSync(root + path, 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1], fill = svg.match(/<svg[^>]*\sfill="([^"]+)"/)?.[1];
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>|<!--[\s\S]*?-->/g, '')
    .replace(/\bid="([^"]+)"/g, `id="${id}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${id}-$1"`);
  return `<symbol id="${id}" viewBox="${viewBox}"${fill ? ` fill="${fill}"` : ''}>${body.trim()}</symbol>`;
}

const W = 640, H = 420, CX = 320, CY = 300, CLOUD_Y = CY - 120;
const ease = n => Array(n).fill('.2 .7 .3 1').join(';');
const scale = (values, begin, dur) =>
  `<animateTransform attributeName="transform" type="scale" values="${values}" begin="${begin}s" dur="${dur}s" fill="freeze" calcMode="spline" keySplines="${ease(values.split(';').length - 1)}"/>`;
const show = (from, to) => `<set attributeName="opacity" to="1" begin="${from}s"/><set attributeName="opacity" to="0" begin="${to}s"/>`;

// the materials start apart and are pulled into the middle, shrinking as they go: slow start, fast middle,
// soft landing (ease-in-out)
const props = [['wood', -170, -40], ['rope', 0, -150], ['sail', 170, -40]].map(([name, dx, dy], i) => `
  <g>${show(0, .2)}
    <g transform="translate(${CX + dx} ${CY + dy})"><animateTransform attributeName="transform" type="translate" values="${CX + dx} ${CY + dy};${CX} ${CLOUD_Y + 60}" begin="${.02 * i}s" dur=".16s" fill="freeze" calcMode="spline" keySplines=".6 0 .3 1"/>
      <g><animateTransform attributeName="transform" type="scale" values="1;.35" begin="${.02 * i}s" dur=".16s" fill="freeze" calcMode="spline" keySplines=".6 0 .3 1"/><use href="#${name}" x="-55" y="-55" width="110" height="110"/></g>
    </g>
  </g>`).join('');

// smoke frames, sized as drawn on their sheet (px) so they keep their relative scale
const K = 1.05;
const frames = [
  {id: 'smoke1', w: 170, h: 143, from: .14, to: .22, grow: '.6;1.15'},
  {id: 'smoke2', w: 341, h: 317, from: .22, to: .42, grow: '.92;1.06;1'},
  {id: 'smoke3', w: 319, h: 289, from: .42, to: .5, grow: '1;1.12'},
  {id: 'smoke4', w: 210, h: 183, from: .5, to: .57, grow: '1;1.2'},
].map(({id, w, h, from, to, grow}) => `
  <g opacity="0">${show(from, to)}
    <g transform="translate(${CX} ${CLOUD_Y})"><g>${scale(grow, from, to - from)}<use href="#${id}" x="${-w * K / 2}" y="${-h * K / 2}" width="${w * K}" height="${h * K}"/></g></g>
  </g>`).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>Boat built</title>
<defs>
${['wood', 'rope', 'sail'].map(id => symbol(id, `${ART}${id}.svg`)).concat([1, 2, 3, 4].map(n => symbol(`smoke${n}`, `scripts/boat-build/smoke/smoke${n}.svg`))).join('\n')}
</defs>${props}${frames}
</svg>
`;
writeFileSync(root + ART + 'build.svg', svg);
console.log(`build.svg ${svg.length} bytes`);
