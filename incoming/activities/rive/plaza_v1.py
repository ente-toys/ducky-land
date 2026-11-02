# plaza.py: builds plaza.rml, the Ducky Land plaza (Ducky Land step 2).
# Flat vector plaza drawn as native Rive shapes, 16 Ducky slots (nested Ducky artboards, drawn back to front),
# a HUD (title, flock, online count, "Quacks today" board) and a looping ambient timeline.
# The page (web/index.html) moves the ducks: every frame it sorts them by y and writes them into slots,
# so a duck lower on screen always draws in front. Slot data = DuckyVM instances 0:70.. from gen.py.
import os, sys, random
sys.path.insert(0, '/Users/pragadees.xd/Developer/hallow-os/tools')
import svg2rml as S
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(7)
W, H = 1600, 1000
OUT = '#232323'
FONT = '0:90'
DUCKY_AB = '0:2'
DUCKY_VM = '0:40'
DUCKY_X, DUCKY_Y = '0:50', '0:51'          # DuckyVM x / y (see gen.py VMP order)
SLOTS = 16
SLOT_INST = [f'0:{70 + k}' for k in range(SLOTS)]
DUCK_SCALE = 0.24

_n = [100]
def nid():
    _n[0] += 1
    return f'5:{_n[0]}'

def col(h, a='FF'):
    return a + h.lstrip('#').upper()

def paint(fill=None, stroke=None, sw=5):
    p = ''
    if fill: p += f'<Fill><SolidColor colorValue="{col(fill)}"/></Fill>'
    if stroke: p += f'<Stroke thickness="{sw}" cap="round" join="round"><SolidColor colorValue="{col(stroke)}"/></Stroke>'
    return p

def ellipse(name, x, y, w, h, fill=None, stroke=OUT, sw=5, extra=''):
    i = nid()
    return i, f'<Shape name="{name}" id="{i}" x="{x:g}" y="{y:g}"{extra}><Ellipse width="{w:g}" height="{h:g}"/>{paint(fill, stroke, sw)}</Shape>'

def rect(name, x, y, w, h, fill=None, stroke=OUT, sw=5, r=0, extra=''):
    i = nid()
    rr = f' cornerRadiusTL="{r:g}"' if r else ''
    return i, f'<Shape name="{name}" id="{i}" x="{x:g}" y="{y:g}"{extra}><Rectangle width="{w:g}" height="{h:g}"{rr}/>{paint(fill, stroke, sw)}</Shape>'

def poly(name, x, y, pts, fill=None, stroke=OUT, sw=5, closed=True, extra=''):
    i = nid()
    v = ''.join(f'<StraightVertex x="{px:g}" y="{py:g}"/>' for px, py in pts)
    return i, f'<Shape name="{name}" id="{i}" x="{x:g}" y="{y:g}"{extra}><PointsPath isClosed="{"true" if closed else "false"}">{v}</PointsPath>{paint(fill, stroke, sw)}</Shape>'

def group(name, x, y, kids, extra=''):
    """kids listed TOP FIRST (Rive paints earlier siblings on top)."""
    i = nid()
    return i, [f'<Node name="{name}" id="{i}" x="{x:g}" y="{y:g}"{extra}>'] + kids + ['</Node>']

def s(t):  # shape tuple -> xml
    return t[1]

IDS = {}

# ---------------- background ----------------
back = []   # paint order BOTTOM FIRST here; reversed when written
back.append(s(rect('Grass', W / 2, H / 2, W, H, '#A9DA84', None)))
for _ in range(26):
    x, y = random.uniform(0, W), random.uniform(0, H)
    back.append(s(ellipse('Grass Patch', x, y, random.uniform(90, 220), random.uniform(30, 70), '#9AD072', None)))
for _ in range(60):
    x, y = random.uniform(0, W), random.uniform(0, H)
    back.append(s(poly('Grass Tuft', x, y, [(-8, 0), (-4, -14), (0, -2), (4, -16), (8, 0)], None, '#7DBE5C', 4, closed=False)))

# plaza floor + cobbles clipped to it
PX, PY, PW, PH = 800, 610, 1400, 780
floor_id, floor = ellipse('Plaza Floor', PX, PY, PW, PH, '#EFE2C7', '#D8C49E', 10)
back.append(floor)
clip_id, clip = ellipse('Cobble Clip', PX, PY, PW - 30, PH - 30, None, None)
cob = []
tones = ['#E5D4B3', '#F6ECD8', '#EADBBE']
y = PY - PH / 2 + 10; row = 0
while y < PY + PH / 2:
    x = PX - PW / 2 + (row % 2) * 26
    while x < PX + PW / 2:
        if random.random() < 0.55:
            cob.append(s(rect('Cobble', x, y, random.uniform(30, 44), random.uniform(14, 19), random.choice(tones), None, r=8)))
        x += 52
    y += 24; row += 1
back.append(clip)
back.append('\n'.join([f'<Node name="Cobbles" id="{nid()}"><ClippingShape sourceId="{clip_id}" name="Clip"/>'] + cob[::-1] + ['</Node>']))

# ---------------- props ----------------
def tree(name, cx, cy, r):
    k = []
    k.append(s(ellipse('Shadow', 0, 0, r * 1.6, r * 0.45, '#8CC56A', None)))
    k.append(s(rect('Trunk', 0, -r * 0.35, r * 0.28, r * 0.8, '#9A6A3E', OUT, 5, r=6)))
    for dx, dy, rr, c in [(-0.45, -1.05, 0.62, '#5FAE4E'), (0.45, -1.05, 0.62, '#5FAE4E'), (0, -1.45, 0.7, '#6DBE5A')]:
        k.append(s(ellipse('Canopy', dx * r, dy * r, rr * r * 2, rr * r * 1.8, c, OUT, 5)))
    k.append(s(ellipse('Shine', -0.2 * r, -1.7 * r, 0.42 * r, 0.22 * r, '#8FD574', None)))
    return group(name, cx, cy, k[::-1])[1]

def lamp(name, cx, cy):
    k = [s(ellipse('Shadow', 0, 0, 60, 16, '#00000022'.replace('#', '#') if False else '#C9B998', None)),
         s(rect('Base', 0, -10, 34, 20, '#3B4A57', OUT, 5, r=6)),
         s(rect('Post', 0, -95, 12, 160, '#3B4A57', OUT, 5)),
         s(rect('Head', 0, -185, 40, 34, '#FFE9A8', OUT, 5, r=8)),
         s(poly('Cap', 0, -205, [(-28, 4), (0, -14), (28, 4)], '#3B4A57', OUT, 5))]
    return group(name, cx, cy, k[::-1])[1]

def bench(name, cx, cy):
    k = [s(ellipse('Shadow', 0, 4, 150, 26, '#D9C7A4', None)),
         s(rect('Leg L', -50, -14, 10, 28, '#7A5233', OUT, 4)), s(rect('Leg R', 50, -14, 10, 28, '#7A5233', OUT, 4)),
         s(rect('Back', 0, -62, 150, 26, '#C68B57', OUT, 5, r=6)),
         s(rect('Seat', 0, -30, 160, 22, '#D9A06A', OUT, 5, r=6))]
    return group(name, cx, cy, k[::-1])[1]

def stall(name, cx, cy, a, b):
    k = [s(ellipse('Shadow', 0, 6, 260, 40, '#D9C7A4', None)),
         s(rect('Post L', -105, -80, 12, 150, '#8E5E36', OUT, 5)), s(rect('Post R', 105, -80, 12, 150, '#8E5E36', OUT, 5)),
         s(rect('Counter', 0, -36, 240, 72, '#C68B57', OUT, 5, r=8)),
         s(rect('Counter Top', 0, -74, 252, 16, '#E0A974', OUT, 5, r=6))]
    # produce on the counter
    for j, (fx, fc) in enumerate([(-80, '#F0645A'), (-28, '#FFC94A'), (24, '#8BD06A'), (76, '#FF9F43')]):
        k.append(s(rect('Crate', fx, -96, 46, 26, '#B57A47', OUT, 4, r=4)))
        for q in range(3):
            k.append(s(ellipse('Fruit', fx - 13 + q * 13, -114, 16, 16, fc, OUT, 3)))
    # striped awning with scallops
    top, bot = -200, -150
    n = 8
    for j in range(n):
        x0 = -136 + j * 34
        k.append(s(poly('Stripe', 0, 0, [(x0 + 6, top), (x0 + 40, top), (x0 + 34, bot), (x0, bot)], a if j % 2 == 0 else b, None)))
        k.append(s(ellipse('Scallop', x0 + 17, bot, 34, 26, a if j % 2 == 0 else b, OUT, 4)))
    k.append(s(poly('Awning Edge', 0, 0, [(-130, top), (142, top), (136, bot), (-136, bot)], None, OUT, 5)))
    return group(name, cx, cy, k[::-1])[1]

def planter(name, cx, cy):
    k = [s(ellipse('Pot', 0, 0, 90, 44, '#C9734F', OUT, 5))]
    for fx, fy, fc in [(-22, -22, '#FF8FA3'), (0, -32, '#FFD166'), (22, -22, '#FFFFFF'), (-8, -16, '#FF8FA3'), (12, -14, '#FFD166')]:
        k.append(s(ellipse('Leaf', fx, fy + 6, 30, 20, '#6DBE5A', OUT, 4)))
        k.append(s(ellipse('Flower', fx, fy, 16, 16, fc, OUT, 3)))
    return group(name, cx, cy, k[::-1])[1]

# statue: the Drip ducky base in stone
def statue(cx, cy, scale):
    path = [f for f in __import__('glob').glob(os.path.join(HERE, '..', 'drip-ref', 'svg', 'ducky_base-*.svg'))][0]
    stone = {'#F4D93B': '#E9E4DB', '#F2BA3D': '#D4CCC0', '#FFF4C5': '#F3F0EA', '#FF814A': '#DDD5C9', 'white': '#FAF8F4', '#232323': '#5B524B'}
    txt = open(path).read()
    for k_, v in stone.items():
        txt = txt.replace(f'fill="{k_}"', f'fill="{v}"')
    frag, _ = S.convert(txt, 'Statue', '6', ind='', x=cx - 357 * scale, y=cy - 776 * scale, scale=scale)
    return frag.split('\n')

FX, FY = 800, 560
fountain = []  # bottom first
fountain.append(s(ellipse('Basin Shadow', FX, FY + 18, 470, 200, '#D9C7A4', None)))
fountain.append(s(ellipse('Basin', FX, FY, 450, 200, '#D8CFC2', OUT, 6)))
fountain.append(s(ellipse('Basin Rim', FX, FY - 8, 404, 166, '#C4B8A7', OUT, 5)))
fountain.append(s(ellipse('Water', FX, FY - 6, 372, 140, '#5FC8D4', None)))
ripples = []
for j in range(3):
    rid, r_ = ellipse(f'Ripple {j}', FX, FY - 2, 200, 70, None, '#B6EAF0', 5)
    ripples.append(rid); fountain.append(r_)
for lx, ly in [(-120, 8), (110, -18), (60, 30)]:
    fountain.append(s(ellipse('Lily Pad', FX + lx, FY + ly, 46, 20, '#6DBE5A', OUT, 3)))
fountain.append(s(ellipse('Pedestal Top', FX, FY - 16, 110, 40, '#C4B8A7', OUT, 5)))
fountain.append('\n'.join(statue(FX, FY - 20, 0.2)))
drops = []
for j, (dx, side) in enumerate([(-1, 0), (1, 0), (-1, 1), (1, 1)]):
    did, d_ = ellipse(f'Drop {j}', FX, FY - 100, 12, 16, '#8EDDE6', OUT, 3)
    drops.append((did, dx, side)); fountain.append(d_)

back_props = [tree('Tree', 90, 210, 95), tree('Tree', 230, 150, 80), tree('Tree', 1390, 150, 85), tree('Tree', 1520, 215, 100),
              tree('Tree', 560, 175, 62), tree('Tree', 1050, 170, 66),
              stall('Stall Fruit', 330, 345, '#F0645A', '#FFF4E0'), stall('Stall Bakery', 800, 290, '#4D8FE0', '#FFF4E0'),
              stall('Stall Flowers', 1270, 345, '#3FB8AF', '#FFF4E0'),
              planter('Planter', 130, 480), planter('Planter', 1470, 480),
              bench('Bench', 215, 640), bench('Bench', 1385, 640)]
# bunting between the two back lamps
bunt = []
bx0, bx1, by = 470, 1130, 222
pts = [(bx0 + (bx1 - bx0) * t / 20, by + 60 * (1 - (2 * t / 20 - 1) ** 2)) for t in range(21)]
bunt.append(s(poly('String', 0, 0, pts, None, '#5B524B', 3, closed=False)))
colors = ['#F0645A', '#FFD166', '#3FB8AF', '#8A55D6']
for t in range(1, 20, 1):
    x, y = pts[t]
    bunt.append(s(poly('Pennant', x, y, [(-11, 0), (11, 0), (0, 26)], colors[t % 4], OUT, 3)))
bunting_id, bunting = group('Bunting', 0, 0, bunt[::-1])
back_props += [lamp('Lamp', 470, 420), lamp('Lamp', 1130, 420), bunting]

front_props = [tree('Tree', 60, 985, 105), tree('Tree', 1545, 990, 115), lamp('Lamp', 330, 880), lamp('Lamp', 1270, 880)]

# ---------------- duck slots ----------------
PVM = '5:1'; PVI = '5:2'
props = {}
def pprop(name, kind, ref=None):
    i = f'5:{10 + len(props)}'
    props[name] = (i, kind, ref)
    return i
for k in range(SLOTS):
    pprop(f'slot{k}', 'ViewModel', DUCKY_VM)
for nm in ['flock', 'online', 'r0name', 'r1name', 'r2name', 'r3name', 'r0count', 'r1count', 'r2count', 'r3count']:
    pprop(nm, 'String')
for nm in ['r0city', 'r1city', 'r2city', 'r3city']:
    pprop(nm, 'Number')

slots = []
for k in range(SLOTS):
    sp = props[f'slot{k}'][0]
    sid = nid()
    slots.append([f'<NestedArtboard artboardId="{DUCKY_AB}" name="Slot {k}" id="{sid}" x="{-500:g}" y="{-500:g}" scaleX="{DUCK_SCALE}" scaleY="{DUCK_SCALE}" dataBindPathIds="{PVM}-{sp}">',
                  f'<DataBindContext sourcePathIds="{PVM}-{sp}-{DUCKY_X}" propertyKey="13"/>',
                  f'<DataBindContext sourcePathIds="{PVM}-{sp}-{DUCKY_Y}" propertyKey="14"/>',
                  '</NestedArtboard>'])
ducks = [f'<Node name="Ducks" id="{nid()}">']
for sl in reversed(slots):   # slot 0 = furthest back = last sibling
    ducks += sl
ducks += ['</Node>']

# ---------------- HUD ----------------
def text(name, txt, size, color, x, y, ox=0.5, oy=0.5, bg=None, bind=None):
    sid = nid(); tid = nid()
    b = f'<TextStyleBackground cornerRadius="{size * 0.55:g}" name="BG"><Fill name="F"><SolidColor colorValue="{col(bg)}"/></Fill></TextStyleBackground>' if bg else ''
    db = f'<DataBindContext sourcePathIds="{bind}" propertyKey="268"/>' if bind else ''
    return [f'<Text name="{name}" id="{tid}" x="{x:g}" y="{y:g}" sizingValue="autoWidth" originX="{ox}" originY="{oy}">',
            f'<TextStylePaint fontSize="{size:g}" lineHeight="{size * 1.6:g}" fontAssetId="{FONT}" name="Style" id="{sid}"><Fill name="Fill"><SolidColor colorValue="{col(color)}"/></Fill>{b}</TextStylePaint>',
            f'<TextValueRun styleId="{sid}" text="{txt}" name="Run">{db}</TextValueRun>', '</Text>']

CITY = [('Kochi', '#22A866'), ('Chennai', '#F07F1A'), ('Bengaluru', '#8A55D6'), ('London', '#2F78DE')]
hud = []  # top first
hud += text('Title', ' Ducky Land ', 44, '#232323', 40, 52, ox=0, bg='#FFFFFF')
hud += text('Flock', ' Your flock: Chennai ', 26, '#FFFFFF', 40, 112, ox=0, bg='#F07F1A', bind=f'{PVM}-{props["flock"][0]}')
hud += text('Online', ' 13 ducks in the plaza ', 22, '#232323', 40, 158, ox=0, bg='#FFFFFF', bind=f'{PVM}-{props["online"][0]}')
# board
bx, by_ = 1395, 150
board = []
board += text('Board Title', 'Quacks today', 26, '#232323', bx - 140, by_ - 85, ox=0)
for r in range(4):
    y = by_ - 38 + r * 44
    dot = [f'<Solo name="Dot {r}" id="{nid()}" x="{bx - 128:g}" y="{y:g}">',
           f'<DataBindContext sourcePathIds="{PVM}-{props[f"r{r}city"][0]}" propertyKey="296"/>']
    for cn, cc in CITY:
        dot.append(s(ellipse(f'Dot {cn}', 0, 0, 20, 20, cc, OUT, 3)))
    dot.append('</Solo>')
    board += dot
    board += text(f'Row {r} City', CITY[r][0], 24, '#232323', bx - 108, y, ox=0, bind=f'{PVM}-{props[f"r{r}name"][0]}')
    board += text(f'Row {r} Count', '0', 24, '#232323', bx + 140, y, ox=1, bind=f'{PVM}-{props[f"r{r}count"][0]}')
board.append(s(rect('Board Card', bx, by_, 320, 230, '#FFFFFF', OUT, 5, r=24)))
hud += board
hud += text('Hint', ' WASD or tap to waddle · Q quack · E dance ', 22, '#FFFFFF', W / 2, H - 34, bg='#232323')

# ---------------- ambient timeline ----------------
def kf(f, v):
    return f'<KeyFrameDouble frame="{f}" value="{v:g}" interpolationType="cubic"><CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/></KeyFrameDouble>'
def kfl(f, v):
    return f'<KeyFrameDouble frame="{f}" value="{v:g}"/>'
amb = ['<LinearAnimation name="Ambient" id="5:90" duration="180" fps="60" loopValue="1">']
for j, rid in enumerate(ripples):
    o = j * 60
    fr = sorted({(o) % 180, (o + 179) % 180})
    def ripple_key(p, a, b):
        ks = []
        for f in range(0, 181, 15):
            t = ((f - o) % 180) / 180
            ks.append(kfl(f, a + (b - a) * t))
        return f'<KeyedProperty propertyKey="{p}">' + ''.join(ks) + '</KeyedProperty>'
    amb.append(f'<KeyedObject objectId="{rid}">' + ripple_key(16, 0.4, 1.7) + ripple_key(17, 0.4, 1.7) + ripple_key(18, 1, 0) + '</KeyedObject>')
for did, dx, side in drops:
    o = side * 45
    xs, ys, ops = [], [], []
    for f in range(0, 181, 6):
        t = ((f - o) % 90) / 90
        xs.append(kfl(f, FX + dx * (20 + 120 * t)))
        ys.append(kfl(f, FY - 95 - 110 * t + 190 * t * t))
        ops.append(kfl(f, 1 if t < 0.85 else 0))
    amb.append(f'<KeyedObject objectId="{did}"><KeyedProperty propertyKey="13">{"".join(xs)}</KeyedProperty><KeyedProperty propertyKey="14">{"".join(ys)}</KeyedProperty><KeyedProperty propertyKey="18">{"".join(ops)}</KeyedProperty></KeyedObject>')
amb.append(f'<KeyedObject objectId="{bunting_id}"><KeyedProperty propertyKey="14">{kf(0, 0)}{kf(90, 5)}{kf(180, 0)}</KeyedProperty></KeyedObject>')
amb.append('</LinearAnimation>')

sm = ['<StateMachine name="Plaza" id="5:7"><StateMachineLayer name="Ambient">',
      '<AnyState x="0" y="-200"/><ExitState x="400" y="-200"/>',
      '<EntryState x="-200" y="0"><StateTransition stateToId="5:8"/></EntryState>',
      '<AnimationState id="5:8" animationId="5:90" x="200" y="0"/>', '</StateMachineLayer></StateMachine>']

# ---------------- view model ----------------
vm = [f'<ViewModel name="PlazaVM" id="{PVM}" defaultInstanceId="{PVI}">']
for nm, (i, kind, ref) in props.items():
    if kind == 'ViewModel':
        vm.append(f'<ViewModelPropertyViewModel viewModelReferenceId="{ref}" name="{nm}" id="{i}"/>')
    else:
        vm.append(f'<ViewModelProperty{kind} name="{nm}" id="{i}"/>')
vm.append(f'<ViewModelInstance name="Default" id="{PVI}" exports="true">')
defaults = {'flock': ' Your flock: Chennai ', 'online': ' 13 ducks in the plaza ',
            'r0name': 'Kochi', 'r1name': 'Chennai', 'r2name': 'Bengaluru', 'r3name': 'London',
            'r0count': '0', 'r1count': '0', 'r2count': '0', 'r3count': '0'}
for nm, (i, kind, ref) in props.items():
    if kind == 'ViewModel':
        vm.append(f'<ViewModelInstanceViewModel viewModelPropertyId="{i}" propertyValue="{SLOT_INST[int(nm[4:])]}"/>')
    elif kind == 'String':
        vm.append(f'<ViewModelInstanceString viewModelPropertyId="{i}" propertyValue="{defaults.get(nm, "")}"/>')
    else:
        vm.append(f'<ViewModelInstanceNumber viewModelPropertyId="{i}" propertyValue="{int(nm[1]) if nm.endswith("city") else 0}"/>')
vm += ['</ViewModelInstance>', '</ViewModel>']

# ---------------- document ----------------
body = []
body += hud                              # top
for p in reversed(front_props): body += (p if isinstance(p, list) else [p])
body += ducks
body += fountain[::-1]
for p in reversed(back_props): body += (p if isinstance(p, list) else [p])
body += back[::-1]                       # bottom

doc = ['<Rive version="1" kind="fragment">',
       f'<Artboard name="Plaza" id="5:3" width="{W}" height="{H}" x="0" y="0" styleId="5:4" defaultStateMachineId="5:7" viewModelId="{PVM}" viewModelInstanceId="{PVI}">',
       '<LayoutComponentStyle name="Artboard Style" id="5:4"/>'] + sm + body + amb + ['</Artboard>'] + vm + ['</Rive>']
open(os.path.join(HERE, 'plaza.rml'), 'w').write('\n'.join(doc))
print('wrote plaza.rml', sum(len(l) for l in doc) // 1024, 'KB')
