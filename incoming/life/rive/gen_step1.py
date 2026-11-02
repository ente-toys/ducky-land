# gen.py: builds scene.rml for the Drip Ducky (Ducky Land step 1).
# Ducky art = drip.ente.com SVGs (713x937, stackable), converted to native Rive shapes.
# Rig: Root > Shadow, FootL, FootR, Body > WingL, WingR, body art, Tuft, Beak, Eyes, Cap/Shades/Acc solos.
# Outfits: each slot is a Solo bound to a view model number (child index, 0 = none).
# Actions: view model number `action` (0 idle, 1 walk, 2 quack, 3 dance) picks the timeline.
import sys, glob, os, xml.etree.ElementTree as ET
sys.path.insert(0, '/Users/pragadees.xd/Developer/hallow-os/tools')
import svg2rml as S

HERE = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(HERE, '..', 'drip-ref', 'svg')
NS = S.SVGNS

def svg_file(name):
    return [f for f in glob.glob(os.path.join(SVG, name + '-*.svg')) if 'prev' not in f][0]

CAPS = [f'CAP {i}' for i in range(1, 14)]
SHADES = ['Shades 2', 'Shades 8', 'Shades 12']
ACCS = ['Acc 4', 'Acc 5', 'Acc 8', 'Acc 9', 'Acc 10', 'Acc 11', 'Acc 12']   # Acc 6 skipped (boss)
SHOES = [f'Shoes {i}' for i in (1, 2, 5, 6, 7, 8, 9, 10, 11, 12)]

# ---------- ids ----------
_n = {'0': 100}
def nid(prefix='0'):
    _n[prefix] = _n.get(prefix, 0) + 1
    return f'{prefix}:{_n[prefix]}'

# ---------- art ----------
_pref = [10]
def shapes_xml(items, px, py):
    """Native shapes for drawable items, positioned relative to a parent at absolute (px, py).
    Items: svg elements, or ('masked', mask_items, inner_items) for <g mask=...>.
    Written reversed because Rive paints earlier siblings on top."""
    out = S.Out(str(_pref[0])); _pref[0] += 1
    return _emit(items, px, py, out)

def _emit(items, px, py, out):
    lines = []
    for it in reversed(items):
        if isinstance(it, tuple):
            _, mask_items, inner = it
            mask_ids = []
            for m in mask_items:
                node = S.collect(m, S.I, {'fill': '#000000'}, 1.0)
                if not node: continue
                node['style'] = {'fill': 'none'}
                S.emit(node, px, py, out, '', lines, False)
                mask_ids.append(f'{out.prefix}:{out.n}')
            lines.append(f'<Node name="Masked" id="{out.nid()}">')
            lines += [f'<ClippingShape sourceId="{i}" name="Clip"/>' for i in mask_ids]
            lines += _emit(inner, px, py, out)
            lines.append('</Node>')
            continue
        node = S.collect(it, S.I, {'fill': '#000000'}, 1.0)
        if node:
            S.emit(node, px, py, out, '', lines, False)
    return lines

def drawables(path):
    """Drawable items of an svg in document order; <g mask> becomes ('masked', mask, inner)."""
    root = ET.parse(path).getroot()
    masks = {el.get('id'): el for el in root.iter() if el.tag.replace(NS, '') == 'mask'}
    def walk(el):
        tag = el.tag.replace(NS, '')
        if tag in ('defs', 'mask', 'clipPath', 'linearGradient', 'radialGradient'):
            return []
        if tag in ('path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'):
            return [el]
        res = []
        for c in el:
            res += walk(c)
        mk = el.get('mask')
        if mk and mk.startswith('url(#'):
            m = masks.get(mk[5:-1])
            if m is not None:
                mres = []
                for c in m: mres += walk(c)
                return [('masked', mres, res)]
        return res
    return walk(root)

def cx_of(el):
    if isinstance(el, tuple):
        return cx_of(el[2][0])
    subs = S.shape_subs(el, S.I)
    b = S.bbox_of(subs)
    return (b[0] + b[2]) / 2

base = drawables(svg_file('ducky_base'))
P = lambda *ix: [base[i] for i in ix]

# pivots, absolute in the 713x937 drip canvas
ROOT = (360, 776)
FOOT_L = (283, 742); FOOT_R = (426, 742)
BODY = (357, 752)
WING_L = (262, 492); WING_R = (452, 492)
TUFT = (372, 312); BEAK = (361, 421); EYES = (360, 400)

def rel(a, b):
    return (a[0] - b[0], a[1] - b[1])

IDS = {}
def node(name, pos, parent, children, extra=''):
    i = nid(); IDS[name] = i
    x, y = rel(pos, parent)
    return [f'<Node name="{name}" id="{i}" x="{x:g}" y="{y:g}"{extra}>'] + children + ['</Node>']

def solo(name, items, pos, parent, prop):
    """Solo slot: child 0 = None, then one Node per item. Bound to view model number `prop`."""
    i = nid(); IDS[name] = i
    x, y = rel(pos, parent)
    kids = []
    none_id = nid()
    kids.append(f'<Node name="None" id="{none_id}"/>')
    for it in items:
        els = drawables(svg_file(it)) if isinstance(it, str) else it[1]
        nm = it if isinstance(it, str) else it[0]
        kids += [f'<Node name="{nm}" id="{nid()}">'] + shapes_xml(els, *pos) + ['</Node>']
    bind = f'<DataBindContext sourcePathIds="{VM}-{VMP[prop]}" propertyKey="296"/>'
    return [f'<Solo name="{name}" id="{i}" x="{x:g}" y="{y:g}" activeComponentId="{none_id}">', bind] + kids + ['</Solo>']

# view model ids
VM = '0:40'
VMP = {k: f'0:{41 + j}' for j, k in enumerate(['action', 'cap', 'shades', 'acc', 'shoes', 'facing', 'bg'])}
VMI = '0:60'

# shoes split left/right by x
def shoe_side(name, left):
    els = [e for e in drawables(svg_file(name)) if (cx_of(e) < 355) == left]
    return (name, els)

shoes_l = solo('Shoes L', [shoe_side(s, True) for s in SHOES], FOOT_L, FOOT_L, 'shoes')
shoes_r = solo('Shoes R', [shoe_side(s, False) for s in SHOES], FOOT_R, FOOT_R, 'shoes')

foot_l = node('FootL', FOOT_L, ROOT, shoes_l + shapes_xml(P(1, 2), *FOOT_L))
foot_r = node('FootR', FOOT_R, ROOT, shoes_r + shapes_xml(P(3, 4), *FOOT_R))
shadow = node('Shadow', (360, 776), ROOT, shapes_xml(P(0), 360, 776))

wing_l = node('WingL', WING_L, BODY, shapes_xml(P(5, 6), *WING_L))
wing_r = node('WingR', WING_R, BODY, shapes_xml(P(7, 8), *WING_R))
tuft = node('Tuft', TUFT, BODY, shapes_xml(P(13, 14, 15), *TUFT))
beak = node('Beak', BEAK, BODY, shapes_xml(P(16, 17), *BEAK))
eyes = node('Eyes', EYES, BODY, shapes_xml(P(18, 19), *EYES))
body_art = node('Body Art', BODY, BODY, shapes_xml(P(9, 10, 11, 12), *BODY))
cap = solo('Cap', CAPS, BODY, BODY, 'cap')
shades = solo('Shades', SHADES, BODY, BODY, 'shades')
acc = solo('Acc', ACCS, BODY, BODY, 'acc')

# paint order bottom->top: wings, body, tuft, beak, eyes, shades, cap, acc. Earlier sibling = on top.
body = node('Body', BODY, ROOT, acc + cap + shades + eyes + beak + tuft + body_art + wing_l + wing_r)
facing_bind = f'<DataBindContext sourcePathIds="{VM}-{VMP["facing"]}" propertyKey="16"/>'
root = node('Root', ROOT, (0, 0), [facing_bind] + body + foot_l + foot_r + shadow)
# preview-only backdrop, hidden unless the host sets bg=1 (the component itself stays transparent)
backdrop = [f'<Shape name="Preview Backdrop" id="{nid()}" x="356.5" y="468.5" opacity="0">',
            f'<DataBindContext sourcePathIds="{VM}-{VMP["bg"]}" propertyKey="18"/>',
            '<Rectangle width="713" height="937"/><Fill><SolidColor colorValue="FFDCE9FA"/></Fill></Shape>']

# ---------- animation ----------
EASE = '<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>'
def kf(frame, value, ease=EASE):
    return f'<KeyFrameDouble frame="{frame}" value="{value:g}" interpolationType="cubic">{ease}</KeyFrameDouble>'

KEYS = {'x': 13, 'y': 14, 'rot': 15, 'sx': 16, 'sy': 17}
def anim(name, aid, dur, tracks, loop=1):
    """tracks: {(nodeName, prop): [(frame, value), ...]}"""
    by = {}
    for (n, p), ks in tracks.items():
        by.setdefault(n, []).append((p, ks))
    xml = [f'<LinearAnimation name="{name}" id="{aid}" duration="{dur}" fps="60" loopValue="{loop}">']
    for n, props in by.items():
        xml.append(f'<KeyedObject objectId="{IDS[n]}">')
        for p, ks in props:
            xml.append(f'<KeyedProperty propertyKey="{KEYS[p]}">' + ''.join(kf(f, v) for f, v in ks) + '</KeyedProperty>')
        xml.append('</KeyedObject>')
    xml.append('</LinearAnimation>')
    return xml

# rest values so every timeline keys the same set (blends return cleanly)
def rest():
    t = {}
    for n in ('Body', 'FootL', 'FootR', 'WingL', 'WingR', 'Tuft', 'Beak', 'Shadow'):
        for p in ('x', 'y', 'rot', 'sx', 'sy'):
            pass
    return t
POS0 = {n: rel(p, par) for n, p, par in [
    ('Body', BODY, ROOT), ('FootL', FOOT_L, ROOT), ('FootR', FOOT_R, ROOT), ('WingL', WING_L, BODY),
    ('WingR', WING_R, BODY), ('Tuft', TUFT, BODY), ('Beak', BEAK, BODY), ('Shadow', (360, 776), ROOT)]}

def tr(n, p, ks):
    """ks values: for x/y offsets relative to rest; rot radians; scales absolute."""
    if p in ('x', 'y'):
        base_v = POS0[n][0 if p == 'x' else 1]
        ks = [(f, base_v + v) for f, v in ks]
    return {(n, p): ks}

def merge(*ds):
    r = {}
    for d in ds: r.update(d)
    return r

# Idle: breathe from the feet, tuft sways late, wings settle. 2 s loop.
IDLE = merge(
    tr('Body', 'sy', [(0, 1), (60, 1.035), (120, 1)]), tr('Body', 'sx', [(0, 1), (60, 0.975), (120, 1)]),
    tr('Tuft', 'rot', [(0, 0), (40, 0.12), (100, -0.08), (120, 0)]),
    tr('WingL', 'rot', [(0, 0), (60, 0.06), (120, 0)]), tr('WingR', 'rot', [(0, 0), (60, -0.06), (120, 0)]),
    tr('Shadow', 'sx', [(0, 1), (60, 0.97), (120, 1)]),
)

# Walk: 2 steps in 40 frames. Feet lift + reach, body bobs up on the passing pose and leans.
W = 40
WALK = merge(
    tr('FootL', 'y', [(0, 0), (10, -34), (20, 0), (40, 0)]), tr('FootL', 'x', [(0, -10), (10, 6), (20, 14), (40, -10)]),
    tr('FootL', 'rot', [(0, 0), (10, -0.25), (20, 0), (40, 0)]),
    tr('FootR', 'y', [(0, 0), (20, 0), (30, -34), (40, 0)]), tr('FootR', 'x', [(0, 14), (20, -10), (30, 6), (40, 14)]),
    tr('FootR', 'rot', [(0, 0), (20, 0), (30, 0.25), (40, 0)]),
    tr('Body', 'y', [(0, 0), (10, -18), (20, 0), (30, -18), (40, 0)]),
    tr('Body', 'rot', [(0, -0.07), (20, 0.07), (40, -0.07)]),
    tr('Body', 'sy', [(0, 0.96), (10, 1.04), (20, 0.96), (30, 1.04), (40, 0.96)]),
    tr('Body', 'sx', [(0, 1.03), (10, 0.97), (20, 1.03), (30, 0.97), (40, 1.03)]),
    tr('WingL', 'rot', [(0, 0.35), (20, -0.15), (40, 0.35)]), tr('WingR', 'rot', [(0, 0.15), (20, -0.35), (40, 0.15)]),
    tr('Tuft', 'rot', [(0, 0.1), (20, -0.1), (40, 0.1)]),
    tr('Shadow', 'sx', [(0, 1), (10, 0.9), (20, 1), (30, 0.9), (40, 1)]),
)

# Quack: anticipation squash, pop up with stretch, beak pops on the peak, land squash, settle, rest.
QUACK = merge(
    tr('Body', 'sy', [(0, 1), (8, 0.82), (16, 1.14), (28, 1.0), (34, 0.86), (44, 1.04), (52, 1), (75, 1)]),
    tr('Body', 'sx', [(0, 1), (8, 1.14), (16, 0.9), (28, 1.0), (34, 1.12), (44, 0.97), (52, 1), (75, 1)]),
    tr('Body', 'y', [(0, 0), (8, 0), (20, -70), (30, 0), (75, 0)]),
    tr('FootL', 'y', [(0, 0), (10, 0), (20, -40), (30, 0), (75, 0)]), tr('FootR', 'y', [(0, 0), (10, 0), (20, -40), (30, 0), (75, 0)]),
    tr('Beak', 'sx', [(0, 1), (14, 1), (18, 1.5), (30, 1.35), (38, 1), (75, 1)]),
    tr('Beak', 'sy', [(0, 1), (14, 1), (18, 1.7), (30, 1.45), (38, 1), (75, 1)]),
    tr('WingL', 'rot', [(0, 0), (8, -0.1), (18, 0.9), (34, 0.1), (75, 0)]), tr('WingR', 'rot', [(0, 0), (8, 0.1), (18, -0.9), (34, -0.1), (75, 0)]),
    tr('Tuft', 'rot', [(0, 0), (10, -0.2), (22, 0.25), (40, -0.1), (75, 0)]),
    tr('Shadow', 'sx', [(0, 1), (8, 1.1), (20, 0.65), (30, 1.12), (44, 1), (75, 1)]),
)

# Dance: side to side with a double bounce, wings up and waving, feet stomp. 48 frames.
DANCE = merge(
    tr('Body', 'x', [(0, -22), (24, 22), (48, -22)]),
    tr('Body', 'rot', [(0, -0.14), (24, 0.14), (48, -0.14)]),
    tr('Body', 'y', [(0, 0), (6, -26), (12, 0), (24, 0), (30, -26), (36, 0), (48, 0)]),
    tr('Body', 'sy', [(0, 0.9), (6, 1.08), (12, 0.9), (24, 0.9), (30, 1.08), (36, 0.9), (48, 0.9)]),
    tr('Body', 'sx', [(0, 1.08), (6, 0.95), (12, 1.08), (24, 1.08), (30, 0.95), (36, 1.08), (48, 1.08)]),
    tr('WingL', 'rot', [(0, 1.3), (12, 1.7), (24, 1.3), (36, 1.7), (48, 1.3)]),
    tr('WingR', 'rot', [(0, -1.7), (12, -1.3), (24, -1.7), (36, -1.3), (48, -1.7)]),
    tr('FootL', 'y', [(0, 0), (6, -20), (12, 0), (48, 0)]), tr('FootR', 'y', [(0, 0), (24, 0), (30, -20), (36, 0), (48, 0)]),
    tr('Tuft', 'rot', [(0, 0.2), (24, -0.2), (48, 0.2)]),
    tr('Shadow', 'x', [(0, -14), (24, 14), (48, -14)]),
)

# every timeline keys every channel any other timeline uses, so leaving a state never strands a pose
ALL = {}
for d in (IDLE, WALK, QUACK, DANCE):
    ALL.update({k: None for k in d})
def fill(d, dur):
    r = dict(d)
    for (n, p) in ALL:
        if (n, p) not in r:
            v = 1 if p in ('sx', 'sy') else 0
            if p in ('x', 'y'):
                v = POS0[n][0 if p == 'x' else 1]
            r[(n, p)] = [(0, v), (dur, v)]
    return r

ANIMS = [('Idle', '0:20', 120, IDLE), ('Walk', '0:21', W, WALK), ('Quack', '0:22', 75, QUACK), ('Dance', '0:23', 48, DANCE)]
anims = []
for nm, aid, dur, d in ANIMS:
    anims += anim(nm, aid, dur, fill(d, dur))

# ---------- state machine ----------
STATE = {k: f'0:{30 + k}' for k in range(4)}
def cond(k):
    return (f'<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyNumber>'
            f'<DataBindContext sourcePathIds="{VM}-{VMP["action"]}" propertyKey="636"/></BindablePropertyNumber>'
            f'</TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="{k}"/></TransitionViewModelCondition>')
sm = ['<StateMachine name="Ducky" id="0:7"><StateMachineLayer name="Action">',
      '<AnyState x="0" y="-200"/><ExitState x="900" y="-200"/>',
      f'<EntryState x="-200" y="0"><StateTransition stateToId="{STATE[0]}"/></EntryState>']
for k, (nm, aid, dur, d) in enumerate(ANIMS):
    sm.append(f'<AnimationState id="{STATE[k]}" animationId="{aid}" x="{k * 220}" y="0">')
    for j in range(4):
        if j != k:
            sm.append(f'<StateTransition stateToId="{STATE[j]}" duration="160">{cond(j)}</StateTransition>')
    sm.append('</AnimationState>')
sm.append('</StateMachineLayer></StateMachine>')

# ---------- document ----------
vm = [f'<ViewModel name="DuckyVM" id="{VM}" defaultInstanceId="{VMI}">']
vm += [f'<ViewModelPropertyNumber name="{k}" id="{v}"/>' for k, v in VMP.items()]
vm.append(f'<ViewModelInstance name="Default" id="{VMI}" exports="true">')
vm += [f'<ViewModelInstanceNumber viewModelPropertyId="{v}" propertyValue="{1 if k == "facing" else 0}"/>' for k, v in VMP.items()]
vm += ['</ViewModelInstance>', '</ViewModel>']

doc = ['<Rive version="1" kind="fragment">',
       f'<Artboard name="Ducky" id="0:2" width="713" height="937" styleId="0:3" defaultStateMachineId="0:7" viewModelId="{VM}" viewModelInstanceId="{VMI}">',
       '<LayoutComponentStyle name="Artboard Style" id="0:3"/>']
doc += sm + root + backdrop + anims + ['</Artboard>'] + vm + ['</Rive>']
open(os.path.join(HERE, 'scene.rml'), 'w').write('\n'.join(doc))
print('wrote scene.rml', sum(len(l) for l in doc) // 1024, 'KB')
