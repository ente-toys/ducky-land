# plaza.py: builds plaza.rml, the Ducky Land plaza v2, redrawn in the Drip Ducky art language (drip_style.py).
# Artboards: Plaza (the game scene) and Style Sheet (the Ducky at plaza scale beside every prop, for the eye check).
# Ducks: 16 stateful Ducky placements drawn back to front; each placement's own view model instance binds to
# PlazaVM.slotK, so the page writes slotK and the nested state machine (walk/quack/dance) actually sees it.
# The page (web/index.html) sorts ducks by y every frame and writes them into slots, so lower = in front.
import os, sys, random
import drip_style as D
from drip_style import blob, group, shape, path_xml, poly_xml, ellipse_pts, fill, stroke, PAL, INK, T, nid

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0]]
import gen  # writes scene.rml (the Ducky) and gives us its masked SVG importer for the statue
from plaza_layout import STALLS, BENCHES, LAMPS, FOUNTAIN, export
export()

W, H = 1600, 1000
FONT = '0:90'
DUCKY_AB = '0:2'
DUCKY_VM = gen.VM
DVP = gen.VMP                      # DuckyVM property ids
SLOTS = 32  # 16 behind the fountain, 16 in front. Unused placements stay offscreen.
SLOT_INST = gen.SLOT_INSTANCES
DS = D.DUCK_SCALE
rng = random.Random(11)

def place(lines, x, y, name='Prop'):
    return group(name, x, y, lines)[1]

# ---------------- ground ----------------
def ground():
    out = []  # TOP FIRST
    # plaza floor: one wobbly cream blob (Drip belly colour), ink edge, cobbles inside
    fpts = D.wobble(ellipse_pts(1400, 780, 16), 10, random.Random(3))
    floor_geo = path_xml(fpts)
    floor_id = nid()
    cobs = []
    r2 = random.Random(5)
    for _ in range(170):
        for _try in range(20):
            x, y = r2.uniform(-680, 680), r2.uniform(-370, 370)
            if (x / 660) ** 2 + (y / 360) ** 2 < 1 and not ((x / 250) ** 2 + ((y + 50) / 120) ** 2 < 1.2):
                break
        cobs.append(place(D.cobble(r2, r2.uniform(26, 40)), x, y, 'Cobble'))
    out.append(shape('Floor Ink', 800, 610, floor_geo, stroke(INK, T * 1.4))[1])
    out += [f'<Node name="Cobbles" id="{nid()}" x="800" y="610"><ClippingShape sourceId="{floor_id}" name="Clip"/>'] + sum(cobs, []) + ['</Node>']
    # floor shading: darker cream side on the right, like the Ducky body
    side_id = nid()
    out.append(shape('Floor Lit', 800 + 60, 610 + 30, floor_geo, fill(PAL['floor'][0]), clips=(floor_id, side_id))[1])
    out.append(shape('Floor Side Clip', 800 - 150, 610, floor_geo, '', sid=side_id)[1])
    out.append(shape('Floor', 800, 610, floor_geo, fill(PAL['floor'][1]), sid=floor_id)[1])
    # grass: flat green with darker flat patches and ink tufts
    tufts = []
    r3 = random.Random(9)
    for _ in range(70):
        x, y = r3.uniform(20, W - 20), r3.uniform(20, H - 20)
        if ((x - 800) / 720) ** 2 + ((y - 610) / 410) ** 2 < 1:
            continue
        tufts += place(D.tuft(r3), x, y, 'Tuft')
    out += tufts
    for _ in range(22):
        x, y = r3.uniform(0, W), r3.uniform(0, H)
        out.append(shape('Grass Patch', x, y, path_xml(D.wobble(ellipse_pts(r3.uniform(120, 260), r3.uniform(40, 80), 9), 8, r3)), fill(PAL['grass'][1]))[1])
    out.append(shape('Grass', W / 2, H / 2, poly_xml([(-W / 2 - 10, -H / 2 - 10), (W / 2 + 10, -H / 2 - 10), (W / 2 + 10, H / 2 + 10), (-W / 2 - 10, H / 2 + 10)]), fill(PAL['grass'][0]))[1])
    return out

# ---------------- fountain ----------------
FX, FY = FOUNTAIN
RIPPLES, DROPS = [], []
def statue(scale):
    """The actual Drip Ducky silhouette in stone, masks honoured (no light spill)."""
    stone = {'#F4D93B': '#E6E2DA', '#F2BA3D': '#C7C3BA', '#FFF4C5': '#F1EEE8', '#FF814A': '#D3CFC7', 'white': '#FFFFFF', '#232323': '#232323'}
    def recolor(items):
        for it in items:
            if isinstance(it, tuple):
                recolor(it[1]); recolor(it[2])
            elif it.get('fill') in stone:
                it.set('fill', stone[it.get('fill')])
    items = gen.drawables(gen.svg_file('ducky_base'))
    items = items[1:]                 # drop the ink floor shadow: the statue stands on its plinth
    recolor(items)
    body = gen.shapes_xml(items, 357, 776)
    return [f'<Node name="Statue" id="{nid()}" x="{FX:g}" y="{FY - 22:g}" scaleX="{scale}" scaleY="{scale}">'] + body + ['</Node>']

def fountain():
    out = []  # TOP FIRST
    for j, side in enumerate([-1, 1, -1, 1]):
        did, d_ = shape(f'Drop {j}', FX, FY - 100, path_xml(ellipse_pts(10, 13, 6)), fill('#BDE8FA') + stroke())
        DROPS.append((did, side, j // 2)); out.append(d_)
    out += statue(0.3)
    out += blob('Plinth', FX, FY - 14, path_xml(D.wobble(ellipse_pts(130, 46, 10), 2, rng)), 'stone2', 130, shade=0.24, hi=0.05)
    for lx, ly in [(-125, 10), (115, -16), (62, 30)]:
        out += blob('Lily Pad', FX + lx, FY + ly, path_xml(ellipse_pts(42, 18, 8)), 'leaf', 42, shade=0.25, hi=0)
    for j in range(3):
        rid, r_ = shape(f'Ripple {j}', FX, FY - 2, path_xml(ellipse_pts(190, 66, 10)), stroke('#FFFFFF', T * 1.2))
        RIPPLES.append(rid); out.append(r_)
    out += blob('Water', FX, FY - 6, path_xml(D.wobble(ellipse_pts(372, 138, 14), 2, rng)), 'water', 372, shade=0.22, hi=0.05)
    out += blob('Basin Rim', FX, FY - 8, path_xml(D.wobble(ellipse_pts(408, 168, 14), 2, rng)), 'stone2', 408, shade=0.2, hi=0.02)
    out += blob('Basin', FX, FY + 6, path_xml(D.wobble(ellipse_pts(452, 200, 14), 3, rng)), 'stone', 452, shade=0.22, hi=0.05)
    out.append(shape('Basin Shadow', FX, FY + 24, path_xml(ellipse_pts(480, 196, 12)), fill(PAL['floor'][1]))[1])
    return out

# ---------------- bunting ----------------
BUNTING_ID = None
def bunting(x0, x1, y0):
    global BUNTING_ID
    pts = [(x0 + (x1 - x0) * t / 20, y0 + 58 * (1 - (2 * t / 20 - 1) ** 2)) for t in range(21)]
    k = []
    cols = ['red', 'amber', 'blue', 'purple', 'pink', 'green']
    for t in range(1, 20):
        k += place(D.pennant(cols[t % len(cols)]), pts[t][0], pts[t][1], 'Pennant')
    k.append(shape('String', 0, 0, path_xml(pts, closed=False), stroke(INK, T))[1])
    BUNTING_ID, lines = group('Bunting', 0, 0, k)
    return lines

# ---------------- scene lists ----------------
back_props = [  # bottom first (each entry is a TOP-FIRST line list)
    place(D.tree(1, 70), 95, 215, 'Tree'), place(D.tree(2, 62), 235, 150, 'Tree'), place(D.tree(3, 66), 1385, 150, 'Tree'),
    place(D.tree(4, 76), 1515, 220, 'Tree'), place(D.tree(5, 50), 560, 165, 'Tree'), place(D.tree(6, 54), 1045, 162, 'Tree'),
    *[place(D.stall(col, 290, seed), x, y, 'Stall ' + name) for x, y, col, seed, name in STALLS],
    place(D.planter(7, 96), 132, 486, 'Planter'), place(D.planter(8, 96), 1468, 486, 'Planter'),
    *[place(D.bench(190), x, y, 'Bench') for x, y, _ in BENCHES],
    *[place(D.lamp(230), x, y, 'Lamp') for x, y in LAMPS[:2]],
]
back_props.append(bunting(470, 1130, 192))
front_props = [place(D.tree(9, 82), 60, 990, 'Tree'), place(D.tree(10, 88), 1545, 995, 'Tree'),
               *[place(D.lamp(230), x, y, 'Lamp') for x, y in LAMPS[2:]],
               place(D.bush(12, 110), 760, 1010, 'Bush'), place(D.bush(13, 96), 860, 1015, 'Bush')]

# ---------------- duck slots (stateful placements bound to PlazaVM.slotK) ----------------
PVM = '5:1'; PVI = '5:2'
props = {}
def pprop(name, kind, ref=None):
    props[name] = (f'5:{10 + len(props)}', kind, ref)
for k in range(SLOTS):
    pprop(f'slot{k}', 'ViewModel', DUCKY_VM)
for nm in ['flock', 'online', 'r0name', 'r1name', 'r2name', 'r3name', 'r0count', 'r1count', 'r2count', 'r3count']:
    pprop(nm, 'String')
for nm in ['r0city', 'r1city', 'r2city', 'r3city']:
    pprop(nm, 'Number')

def ducky_instance(binds_to=None, values=None):
    """A placement's own DuckyVM instance; each value bound to PlazaVM.<slot>.<prop> when binds_to is given."""
    values = values or {}
    iid = nid()
    x = [f'<ViewModelInstance viewModelId="{DUCKY_VM}" exports="true" name="Placement" id="{iid}">']
    for pk, pid in DVP.items():
        strv = pk in gen.STRINGS
        tag = 'String' if strv else 'Number'
        v = values.get(pk, ' ducky ' if strv else (1 if pk == 'facing' else 0))
        b = f'<DataBindContext sourcePathIds="{PVM}-{props[binds_to][0]}-{pid}" propertyKey="{561 if strv else 575}"/>' if binds_to else ''
        x.append(f'<ViewModelInstance{tag} viewModelPropertyId="{pid}" propertyValue="{v}">{b}</ViewModelInstance{tag}>')
    x.append('</ViewModelInstance>')
    return x

slots = []
for k in range(SLOTS):
    sp = props[f'slot{k}'][0]
    slots.append([f'<NestedArtboard artboardId="{DUCKY_AB}" isStateful="true" name="Slot {k}" id="{nid()}" x="-2000" y="-2000" scaleX="{DS}" scaleY="{DS}">',
                  f'<DataBindContext sourcePathIds="{PVM}-{sp}-{DVP["x"]}" propertyKey="13"/>',
                  f'<DataBindContext sourcePathIds="{PVM}-{sp}-{DVP["y"]}" propertyKey="14"/>']
                 + ducky_instance(f'slot{k}') + [f'<NestedStateMachine animationId="0:7" name="Ducky SM"/>', '</NestedArtboard>'])
ducks_back = [f'<Node name="Ducks behind fountain" id="{nid()}">'] + sum(reversed(slots[:16]), []) + ['</Node>']
ducks_front = [f'<Node name="Ducks in front of fountain" id="{nid()}">'] + sum(reversed(slots[16:]), []) + ['</Node>']

# ---------------- HUD (Drip UI: white rounded cards, ink outline, Gilroy) ----------------
HUD_T = 3
def text(name, txt, size, color, x, y, ox=0.5, oy=0.5, bg=None, bind=None):
    sid = nid(); tid = nid()
    b = (f'<TextStyleBackground cornerRadius="{size * 0.6:g}" name="BG"><Fill name="F"><SolidColor colorValue="{D.c(bg)}"/></Fill>'
         f'<Stroke thickness="{HUD_T}"><SolidColor colorValue="{D.c(INK)}"/></Stroke></TextStyleBackground>') if bg else ''
    db = f'<DataBindContext sourcePathIds="{bind}" propertyKey="268"/>' if bind else ''
    return [f'<Text name="{name}" id="{tid}" x="{x:g}" y="{y:g}" sizingValue="autoWidth" originX="{ox}" originY="{oy}">',
            f'<TextStylePaint fontSize="{size:g}" lineHeight="{size * 1.7:g}" fontAssetId="{FONT}" name="Style" id="{sid}"><Fill name="Fill"><SolidColor colorValue="{D.c(color)}"/></Fill>{b}</TextStylePaint>',
            f'<TextValueRun styleId="{sid}" text="{txt}" name="Run">{db}</TextValueRun>', '</Text>']

CITY = [('Kochi', 'green'), ('Chennai', 'amber'), ('Bengaluru', 'purple'), ('London', 'blue')]
hud = []
hud += text('Title', '  Ducky Land  ', 42, INK, 36, 54, ox=0, bg='#FFFFFF')
hud += text('Flock', '  Your flock: Chennai  ', 24, '#FFFFFF', 36, 116, ox=0, bg=PAL['amber'][0], bind=f'{PVM}-{props["flock"][0]}')
hud += text('Online', '  13 ducks in the plaza  ', 20, INK, 36, 162, ox=0, bg='#FFF4C5', bind=f'{PVM}-{props["online"][0]}')
bx, by_ = 1398, 152
board = text('Board Title', 'Quacks today', 26, INK, bx - 138, by_ - 84, ox=0)
for r in range(4):
    y = by_ - 36 + r * 44
    dot = [f'<Solo name="Dot {r}" id="{nid()}" x="{bx - 126:g}" y="{y:g}">', f'<DataBindContext sourcePathIds="{PVM}-{props[f"r{r}city"][0]}" propertyKey="296"/>']
    for cn, cc in CITY:
        dot += group(f'Dot {cn}', 0, 0, blob('Dot', 0, 0, path_xml(ellipse_pts(20, 20, 8)), cc, 20, shade=0.3, hi=0))[1]
    dot.append('</Solo>')
    board += dot
    board += text(f'Row {r} City', CITY[r][0], 23, INK, bx - 106, y, ox=0, bind=f'{PVM}-{props[f"r{r}name"][0]}')
    board += text(f'Row {r} Count', '0', 23, INK, bx + 138, y, ox=1, bind=f'{PVM}-{props[f"r{r}count"][0]}')
board.append(shape('Board Card', bx, by_, poly_xml([(-160, -116), (160, -116), (160, 116), (-160, 116)], radius=26), fill('#FFFFFF') + stroke(INK, HUD_T))[1])
hud += board
hud += text('Hint', '  WASD or tap to waddle · Q quack · E dance  ', 21, '#FFFFFF', W / 2, H - 36, bg=INK)

# ---------------- ambient timeline ----------------
PLAZA_FOUNTAIN = fountain()
RIPPLES, DROPS = list(RIPPLES), list(DROPS)
def kfl(f, v): return f'<KeyFrameDouble frame="{f}" value="{v:g}"/>'
def kfc(f, v): return f'<KeyFrameDouble frame="{f}" value="{v:g}" interpolationType="cubic"><CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/></KeyFrameDouble>'
amb = ['<LinearAnimation name="Ambient" id="5:90" duration="180" fps="60" loopValue="1">']
for j, rid in enumerate(RIPPLES):
    o = j * 60
    def rk(p, a, b):
        return f'<KeyedProperty propertyKey="{p}">' + ''.join(kfl(f, a + (b - a) * (((f - o) % 180) / 180)) for f in range(0, 181, 15)) + '</KeyedProperty>'
    amb.append(f'<KeyedObject objectId="{rid}">' + rk(16, 0.4, 1.7) + rk(17, 0.4, 1.7) + rk(18, 1, 0) + '</KeyedObject>')
for did, side, late in DROPS:
    o = late * 45
    xs, ys, ops = [], [], []
    for f in range(0, 181, 6):
        t = ((f - o) % 90) / 90
        xs.append(kfl(f, FX + side * (24 + 120 * t))); ys.append(kfl(f, FY - 110 - 100 * t + 190 * t * t)); ops.append(kfl(f, 1 if t < 0.85 else 0))
    amb.append(f'<KeyedObject objectId="{did}"><KeyedProperty propertyKey="13">{"".join(xs)}</KeyedProperty><KeyedProperty propertyKey="14">{"".join(ys)}</KeyedProperty><KeyedProperty propertyKey="18">{"".join(ops)}</KeyedProperty></KeyedObject>')
amb.append(f'<KeyedObject objectId="{BUNTING_ID}"><KeyedProperty propertyKey="14">{kfc(0, 0)}{kfc(90, 5)}{kfc(180, 0)}</KeyedProperty></KeyedObject>')
amb.append('</LinearAnimation>')

def state_machine(sid, aid):
    return [f'<StateMachine name="Plaza" id="{sid}"><StateMachineLayer name="Ambient">',
            '<AnyState x="0" y="-200"/><ExitState x="400" y="-200"/>',
            f'<EntryState x="-200" y="0"><StateTransition stateToId="{sid}0"/></EntryState>',
            f'<AnimationState id="{sid}0" animationId="{aid}" x="200" y="0"/>', '</StateMachineLayer></StateMachine>']

# ---------------- view model ----------------
vm = [f'<ViewModel name="PlazaVM" id="{PVM}" defaultInstanceId="{PVI}">']
for nm, (i, kind, ref) in props.items():
    vm.append(f'<ViewModelPropertyViewModel viewModelReferenceId="{ref}" name="{nm}" id="{i}"/>' if kind == 'ViewModel' else f'<ViewModelProperty{kind} name="{nm}" id="{i}"/>')
vm.append(f'<ViewModelInstance name="Default" id="{PVI}" exports="true">')
defaults = {'flock': '  Your flock: Chennai  ', 'online': '  13 ducks in the plaza  ', 'r0name': 'Kochi', 'r1name': 'Chennai', 'r2name': 'Bengaluru', 'r3name': 'London'}
for nm, (i, kind, ref) in props.items():
    if kind == 'ViewModel':
        vm.append(f'<ViewModelInstanceViewModel viewModelPropertyId="{i}" propertyValue="{SLOT_INST[int(nm[4:])]}"/>')
    elif kind == 'String':
        vm.append(f'<ViewModelInstanceString viewModelPropertyId="{i}" propertyValue="{defaults.get(nm, "0")}"/>')
    else:
        vm.append(f'<ViewModelInstanceNumber viewModelPropertyId="{i}" propertyValue="{int(nm[1])}"/>')
vm += ['</ViewModelInstance>', '</ViewModel>']

# ---------------- Plaza artboard ----------------
body = []  # HUD removed (boss 29 Oct); kept in plaza_hud_backup.py
for p in reversed(front_props): body += p
body += ducks_front
body += PLAZA_FOUNTAIN
body += ducks_back
for p in reversed(back_props): body += p
body += ground()
plaza = [f'<Artboard name="Plaza" id="5:3" width="{W}" height="{H}" x="0" y="0" styleId="5:4" defaultStateMachineId="5:7" viewModelId="{PVM}" viewModelInstanceId="{PVI}">',
         '<LayoutComponentStyle name="Artboard Style" id="5:4"/>'] + state_machine('5:7', '5:90') + body + amb + ['</Artboard>']

# ---------------- Style Sheet artboard: the Ducky at plaza scale beside every prop ----------------
SW, SH = 1700, 640
sheet_items = [('Tree', D.tree(1, 70)), ('Bush', D.bush(12, 100)), ('Planter', D.planter(7, 96)), ('Bench', D.bench(190)),
               ('Lamp', D.lamp(230)), ('Stall', D.stall('red', 290, 1))]
sb = []
x = 110
duck_spots = []
for nm, lines in sheet_items:
    w_ = {'Tree': 160, 'Bush': 110, 'Planter': 110, 'Bench': 210, 'Lamp': 80, 'Stall': 310}[nm]
    sb += place(lines, x + w_ / 2, 300, nm)
    duck_spots.append(x + w_ + 70)
    x += w_ + 150
ducks_sheet = []
outfits = [{'cap': 1}, {'cap': 3, 'shoes': 2}, {}, {'cap': 9, 'acc': 3}, {'shades': 1}, {'cap': 6}]
for dx, vals in zip(duck_spots, outfits):
    ducks_sheet += [f'<NestedArtboard artboardId="{DUCKY_AB}" isStateful="true" name="Ducky" id="{nid()}" x="{dx:g}" y="300" scaleX="{DS}" scaleY="{DS}">'] + ducky_instance(None, vals) + ['<NestedStateMachine animationId="0:7" name="Ducky SM"/>', '</NestedArtboard>']
# second row: fountain + cobbles + bunting + HUD bits
FX0, FY0 = FX, FY
_r, _d = list(RIPPLES), list(DROPS)
fx_lines = fountain()
RIPPLES[:], DROPS[:] = _r, _d
row2 = group('Fountain', 380 - FX0, 540 - FY0 + 40, fx_lines)[1]
cob_row = []
r4 = random.Random(2)
for j in range(9):
    cob_row += place(D.cobble(r4, r4.uniform(26, 40)), 760 + j * 46, 560 + (j % 2) * 14, 'Cobble')
cob_row.append(shape('Floor Swatch', 940, 560, poly_xml([(-210, -60), (210, -60), (210, 60), (-210, 60)], radius=30), fill(PAL['floor'][0]) + stroke())[1])
bunt = []
for j, col in enumerate(['red', 'amber', 'blue', 'purple', 'pink', 'green']):
    bunt += place(D.pennant(col), 1220 + j * 50, 500 + 8 * (1 - ((j - 2.5) / 2.5) ** 2), 'Pennant')
ducks_sheet += [f'<NestedArtboard artboardId="{DUCKY_AB}" isStateful="true" name="Ducky" id="{nid()}" x="660" y="600" scaleX="{DS}" scaleY="{DS}">'] + ducky_instance(None, {'cap': 8, 'action': 2}) + ['<NestedStateMachine animationId="0:7" name="Ducky SM"/>', '</NestedArtboard>']
ducks_sheet += [f'<NestedArtboard artboardId="{DUCKY_AB}" isStateful="true" name="Ducky" id="{nid()}" x="1580" y="600" scaleX="{DS}" scaleY="{DS}">'] + ducky_instance(None, {'cap': 11, 'name': ' aya_22 ', 'city': 1, 'action': 3}) + ['<NestedStateMachine animationId="0:7" name="Ducky SM"/>', '</NestedArtboard>']
sheet_bg = [shape('Grass', SW / 2, SH / 2, poly_xml([(-SW / 2, -SH / 2), (SW / 2, -SH / 2), (SW / 2, SH / 2), (-SW / 2, SH / 2)]), fill(PAL['grass'][0]))[1]]
sheet = [f'<Artboard name="Style Sheet" id="5:5" width="{SW}" height="{SH}" x="1800" y="0" styleId="5:6" defaultStateMachineId="5:8">',
         '<LayoutComponentStyle name="Artboard Style" id="5:6"/>',
         '<StateMachine name="Sheet" id="5:8"><StateMachineLayer name="L"><AnyState x="0" y="-200"/><ExitState x="400" y="-200"/><EntryState x="-200" y="0"/></StateMachineLayer></StateMachine>'] \
        + ducks_sheet + bunt + cob_row + row2 + sb + sheet_bg + ['</Artboard>']

doc = ['<Rive version="1" kind="fragment">'] + plaza + sheet + vm + ['</Rive>']
open(os.path.join(HERE, 'plaza.rml'), 'w').write('\n'.join(doc))
print('wrote plaza.rml', sum(len(l) for l in doc) // 1024, 'KB')
