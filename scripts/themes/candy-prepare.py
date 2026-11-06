from pathlib import Path
# Reuse the proven assembly/clearance code, with candy-only assets and data paths.
replacements=[('teacup-ride','sugar-playground'),('goose-float','sundae-kiosk'),('ticket-booth','bakery-kiosk'),('ribbon-arch','candy-arch'),('wish-flag','lollipop-tree'),('fair-lamp','candy-lamp'),('tulip-planter','gumdrop-planter'),('balloons','bouquets'),('carousel','falls'),('castle','cupcake'),('teacups','sugarGarden'),('Waddlewish Fair','Candy Coast'),('Fair island','Candy Coast'),('FAIR','CANDY'),('Fair','Candy'),('fair','candy')]
def trans(s):
 for a,b in replacements:s=s.replace(a,b)
 return s.replace("sandcupcake", "sandcastle")
s=trans(Path('scripts/themes/fair-world.mjs').read_text())
s=s[:s.index('// Install the locked centre')]
s=s.replace("const castle =", "const castle =")
# Distinct scalloped coast following the candy concept, with two south scoop islets.
start=s.index('const COAST_C =');end=s.index('const EDGE =',start)
s=s[:start]+'''const COAST_C = [[145,148],[258,104],[370,70],[500,86],[620,57],[736,35],[866,72],[1008,60],[1130,54],[1250,91],[1378,124],[1432,205],[1468,321],[1445,432],[1472,540],[1451,663],[1360,750],[1240,792],[1132,814],[1020,789],[908,814],[800,784],[694,813],[576,789],[458,810],[342,783],[235,752],[146,704],[104,615],[80,516],[98,418],[78,325],[110,244]];
''' +s[end:]
# Existing IDs are stable within candy only. Cafe moves north, above the fountain.
s=s.replace("'Egg-top cupcake'", "'Cupcake cafe'")
s=s.replace("'Teacup ride'", "'Frosting playground'").replace("'Carousel'", "'Chocolate waterfall'").replace("'Goose parade float'", "'Sundae kiosk'")
s=s.replace("'Candy lamp'", "'Candy-cane lamp'").replace("'Wish flag'", "'Lollipop tree'").replace("'Tulip planter'", "'Gumdrop bush'").replace("'Balloons'", "'Candy bouquet'")
s=s.replace("'Wish maypole (centre placeholder)'", "'Ice cream fountain placeholder'")
# Keep the home green and turquoise, with pastel accents only in paths and paving.
s=s.replace("grass: '#9CC63E'", "grass: '#9CC63E'")
s=s.replace("g.push(pathLayer(0, '#FFF0AE') + plazaLayer(0, '#FFF0AE'));", "g.push(pathLayer(0, '#FFF0C5') + plazaLayer(0, '#FFF0C5'));\n"+'''// Candy ribbon insets, drawn on the same continuous soft path curves.
for(const p of PATHS) g.push(`<path d="${d(p.line)}" fill="none" stroke="#F7BDCD" stroke-width="${p.w-28}" stroke-dasharray="48 62" stroke-linecap="butt" stroke-linejoin="round"/>`);
''')
# Soft rolling market lane and its three reserved strips, instead of a straight slab.
s=s.replace('[[160,700],[320,692],[480,690],[640,696],[760,702],[880,696],[1040,690],[1180,700],[1280,694]]', '[[160,700],[320,676],[480,693],[640,724],[760,718],[880,693],[1040,690],[1180,712],[1280,694]]')
s=s.replace("sea: '#7FD3D6'", "sea: '#8CC8CD'")
s=s.replace("'Sundae kiosk'", "'Sundae kiosk'")
s=s.replace('[[336,202],[250,168],[170,160],[90,170]]','[[336,202],[250,190],[180,192],[145,180]]')
s=s.replace('// ---------- inland water ----------', "PATHS[13].line = catmull([T([160,700]), hFoot], false, 8);\nPATHS[3].line = catmull([T([1168,196]), T([1260,182]), T([1360,190]), east.a], false, 8);\n\n// ---------- inland water ----------")
# More tree candidates; canopy pass will naturally group and space them.
s=s.replace('trees < 62','trees < 68')
s += "\nawait import('./candy-polish.mjs');\nawait import('./candy-detail.mjs');\nawait import('./candy-finish.mjs');\n"
Path('scripts/themes/candy-world.mjs').write_text(s)
for n in ['polish','finish','render','compare','home-reference','review','capture']:
 ext='js' if n=='review' else 'mjs'
 s=trans(Path(f'scripts/themes/fair-{n}.{ext}').read_text())
 s=s.replace(':5265',':5303')
 if n=='polish':
  s=s.replace('i<6;i++)props.push','i<20;i++)props.push').replace('x:1400+i*780,y:3700','x:1100+(i%7)*780,y:3700-Math.floor(i/7)*850')
 if n=='finish':
  s=s.replace("cupcake:'hall'", "cupcake:'hall','bridge-front':'none'")
  s=s.replace("name:'Teapot garden '+p.id", "name:'Ice cream fountain '+p.id").replace("'teapot garden'","'ice cream fountain'").replace("landmark:'candy-centre-teapot'","landmark:'candy-centre-cone'")
 s=s.replace("sea:'#7FD3D6'", "sea:'#8CC8CD'")
 if n=='capture':
  s=s.replace("['candy',[3570,1900,.65]]", "['cafe',[3570,1900,.65]]")
 Path(f'scripts/themes/candy-{n}.{ext}').write_text(s)
Path('public/pixi-art/themes/candy/review.html').write_text(trans(Path('public/pixi-art/themes/fair/review.html').read_text()))
