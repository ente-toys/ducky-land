import fs from 'node:fs';

const base = 'public/pixi-art/themes/bog-arena/';
let ground = fs.readFileSync(base + 'ground.svg', 'utf8');
ground = ground.replace(/\s*<g id="midnight-soil"[\s\S]*?<\/g>/, '');
fs.writeFileSync(base + 'ground.svg', ground);
fs.writeFileSync('public/pixi-art/globe/bog-arena-ground.svg',
  ground.replace('width="8400" height="8200"', 'width="1024" height="1000"'));

const rock = fs.readFileSync(base + 'home/rock.svg', 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  .replaceAll('#E4C567', '#ba92bf').replaceAll('#39472D', '#342d35');
fs.writeFileSync(base + 'home/pond-frog.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="64" viewBox="0 0 80 64">
  <title>Small pond frog resting on a Home stone</title>
  <g transform="translate(40 63) scale(.74)">${rock}</g>
  <g stroke="#342d35" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M27 37Q14 31 17 42Q18 48 29 46M52 37Q65 31 63 42Q62 48 51 46" fill="#88b741"/>
    <path d="M25 42Q19 29 26 22Q22 10 30 10Q36 10 36 18L44 18Q45 9 51 11Q58 12 54 23Q61 32 54 43Q41 51 25 42Z" fill="#a9cf4c"/>
    <path d="M30 34Q40 29 50 35L49 43Q40 48 31 42Z" fill="#d7e59b" stroke="none"/>
    <path d="M29 34Q40 41 51 33M31 39L29 47M49 39L51 47M25 47h8M47 47h8" fill="none"/>
  </g>
  <g fill="#342d35"><circle cx="30" cy="18" r="2"/><circle cx="50" cy="18" r="2"/></g>
</svg>\n`);

fs.writeFileSync(base + 'home/firefly-glints.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="72" viewBox="0 0 128 72">
  <title>Three still dusk fireflies</title>
  <g fill="#fff0c7" opacity=".42">
    <ellipse cx="16" cy="43" rx="3" ry="1.5" transform="rotate(-28 16 43)"/>
    <ellipse cx="22" cy="43" rx="3" ry="1.5" transform="rotate(28 22 43)"/>
    <ellipse cx="67" cy="17" rx="2.5" ry="1.3" transform="rotate(-28 67 17)"/>
    <ellipse cx="72" cy="17" rx="2.5" ry="1.3" transform="rotate(28 72 17)"/>
    <ellipse cx="106" cy="56" rx="2.5" ry="1.3" transform="rotate(-28 106 56)"/>
    <ellipse cx="111" cy="56" rx="2.5" ry="1.3" transform="rotate(28 111 56)"/>
  </g>
  <g fill="#fff0c7" opacity=".8"><ellipse cx="19" cy="46" rx="1.6" ry="2.2"/><ellipse cx="69.5" cy="20" rx="1.4" ry="2"/><ellipse cx="108.5" cy="59" rx="1.4" ry="2"/></g>
</svg>\n`);
fs.writeFileSync(base + 'home/lantern-ground-glow.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="44" viewBox="0 0 110 44">
  <title>Faint flat lantern light on the paving</title>
  <ellipse cx="55" cy="22" rx="53" ry="20" fill="#fff0c7" opacity=".09"/>
  <ellipse cx="55" cy="22" rx="30" ry="10" fill="#fff0c7" opacity=".07"/>
</svg>\n`);

const file = base + 'art.json', art = JSON.parse(fs.readFileSync(file, 'utf8'));
art.props = art.props.filter(p => !p.id?.startsWith('ground-life-'));
art.flats = art.flats.filter(p => !p.id?.startsWith('ground-life-'));
function prop(id, name, x, y, width, height, extra = {}) {
  art.props.push({id: 'ground-life-' + id, name, src: `home/${name}.svg`, x, y, width, height,
    scale: 1, anchor: {x: .5, y: 1}, shadow: false, wind: false, ...extra});
}
for (const [id, x, y] of [['west-pool', 2165, 2700], ['east-pool', 6500, 2680],
  ['willow-pool', 5800, 3530], ['cove', 4745, 7210]]) prop(id, 'pond-frog', x, y, 80, 64);
for (const [id, x, y] of [['nw', 1160, 2100], ['ne', 7140, 2050],
  ['west-pool', 2470, 3060], ['site-b', 7110, 4210], ['mid', 5050, 1740],
  ['sw', 1110, 6120], ['se', 7130, 6050], ['cove', 3510, 6660]]) {
  prop('fireflies-' + id, 'firefly-glints', x, y, 128, 72);
}
for (const [id, x, y] of [['sw', 2530, 5710], ['se', 7170, 5780]]) {
  prop('moth-' + id, 'cream-moth', x, y, 32, 24,
    {homeSource: '/pixi-art/themes/community/detail/garden-butterfly.svg'});
}
for (const p of art.props.filter(p => p.name === 'lantern')) {
  art.flats.push({id: 'ground-life-glow-' + p.id, src: 'home/lantern-ground-glow.svg',
    x: p.x, y: p.y + 22, width: 110, height: 44});
}
fs.writeFileSync(file, JSON.stringify(art, null, 2) + '\n');
console.log('Ground cleaned, fallback synchronized; 4 pond frogs, 24 tiny glints, 8 total moths and 22 lantern pools.');
