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
_pref = [70]   # plaza.rml owns 10 and 11
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
VMP = {k: f'0:{41 + j}' for j, k in enumerate(['action', 'cap', 'shades', 'acc', 'shoes', 'facing', 'bg', 'city', 'isPlayer', 'x', 'y', 'name', 'turn'])}
VMP['spin'] = '8:1999'   # signed turn speed (-1..1) from the host; drives the part delays while turning
STRINGS = {'name'}
VMI = '0:60'

# shoes split left/right by x
def shoe_side(name, left):
    els = [e for e in drawables(svg_file(name)) if (cx_of(e) < 355) == left]
    return (name, els)

# ================= morph turn rig (official views as key shapes, continuous motion) =================
import math
import morph as MO
SPIN = os.path.join(HERE, '..', 'duck-spin')
V = MO.load(SPIN)
VA = sorted(V)                                 # -135 .. 180
REST = {}
INKC = 'FF232323'
COL = {'body_fill': 'FFFFD525', 'body_ink': INKC, 'tuft_ink': INKC, 'wingA_ink': INKC, 'wingB_ink': INKC, 'tail_ink': INKC, 'beak_ink': INKC, 'body': 'FFFFD525', 'hi': 'FFFFFFFF', 'belly': 'FFFFDF58', 'tuft': 'FFFFD525', 'tw1': 'FFFFFFFF', 'tw2': 'FFFFFFFF',
       'wingA': 'FFFFD525', 'wingB': 'FFFFD525', 'tail': 'FFFFD525', 'beak': 'FFFF814A', 'eyeR': INKC, 'eyeL': INKC,
       'footA': 'FFFF814A', 'footB': 'FFFF814A', 'soleA': '00232323', 'soleB': '00232323', 'tail_inkT': INKC, 'wingA_inkT': INKC, 'wingB_inkT': INKC, 'wingA_ink2': INKC, 'wingB_ink2': INKC}  # soles hidden: boss 29 Oct, no dark band under the body
STROKE = {k: 0 for k in COL}
for k, base_ in [('footA', 'footA'), ('footB', 'footB'), ('beak', 'beak')]:   # tail uses its own official ink crescent, no stroke
    offs = [MO.ring_offset(V[a][base_], V[a][base_ + '_ring']) for a in VA if base_ in V[a] and base_ + '_ring' in V[a]]
    STROKE[k] = round(1.5 * sum(offs) / len(offs), 2)
NV = {'body_fill': 64, 'body_ink': 72, 'tuft_ink': 96, 'wingA_ink': 72, 'wingB_ink': 72, 'tail_ink': 72, 'beak_ink': 48, 'body': 56, 'hi': 28, 'belly': 32, 'tuft': 36, 'tw1': 16, 'tw2': 16, 'wingA': 36, 'wingB': 36, 'tail': 32, 'beak': 28,
      'eyeR': 12, 'eyeL': 12, 'footA': 28, 'footB': 28, 'soleA': 20, 'soleB': 20, 'wingA_ink2': 72, 'wingB_ink2': 72, 'tail_inkT': 72, 'wingA_inkT': 72, 'wingB_inkT': 72}

# resample every present part; fill the gaps (parts a view does not draw) so every key has every part
def canon(P):
    """same winding + same start (topmost point) for every closed part, so morph points correspond between views"""
    a = sum(P[i - 1][0] * P[i][1] - P[i][0] * P[i - 1][1] for i in range(len(P)))
    if a < 0: P = P[::-1]
    i0 = min(range(len(P)), key=lambda i: (round(P[i][1], 1), P[i][0]))
    return P[i0:] + P[:i0]
R = {a: {p: (canon(MO.resample(canon(V[a][p]), NV[p])) if p.startswith('wing') else MO.resample(V[a][p], NV[p])) for p in NV if p in V[a]} for a in VA}
def nearest_with(p, a, prefer=None):
    order = sorted(VA, key=lambda b: (abs(MO.wrapd(b - a)), 0 if prefer is None else -prefer * MO.wrapd(b - a)))
    return next(b for b in order if p in V[b])
def avg(P, Q): return [((x1 + x2) / 2, (y1 + y2) / 2) for (x1, y1), (x2, y2) in zip(P, Q)]
def shift(P, dx, dy=0): return [(x + dx, y + dy) for x, y in P]
for a in VA:
    r = R[a]
    for p in ('wingA', 'wingA_ink', 'wingB', 'wingB_ink'):
        if p not in r: r[p] = avg(R[MO.vk(a + 45)][p], R[MO.vk(a - 45)][p])
    if 'footB' not in r: r['footB'] = list(r['footA'])
    if 'soleB' not in r: r['soleB'] = list(r['soleA'])
    for p in ('beak', 'beak_ink', 'belly'):
        if p not in r: r[p] = list(R[nearest_with(p, a)][p])
INK_W = 8.8      # body outline weight (official body ring band); tail and wing outlines match it
def outward(P, o):
    a = sum(P[i - 1][0] * P[i][1] - P[i][0] * P[i - 1][1] for i in range(len(P)))
    return MO.offset(P, -o if a > 0 else o)
for a in VA:
    r = R[a]
    for p, base in (('tail_inkT', 'tail_ink'), ('wingA_inkT', 'wingA_ink'), ('wingB_inkT', 'wingB_ink')):
        r[p] = outward(r[base], 4.8)
WING_IN = 12     # boss 29 Oct: wings stay attached to the body; slide the whole wing in, never stretch it
for a in VA:
    r = R[a]
    bcx = sum(x for x, _ in r['body_fill']) / len(r['body_fill'])
    for k in ('A', 'B'):
        wcx = sum(x for x, _ in r['wing' + k]) / len(r['wing' + k])
        dx = WING_IN if bcx > wcx else -WING_IN
        for p in ('wing' + k, 'wing' + k + '_ink', 'wing' + k + '_inkT'):
            r[p] = [(x + dx, y) for x, y in r[p]]
for a in VA:   # eyes: the far eye on a side view waits just past the front edge (clipped); back views copy (hidden)
    r = R[a]
    s = math.sin(math.radians(a))
    if 'eyeL' not in r and 'eyeR' in r: r['eyeL'] = shift(r['eyeR'], 70 if s > 0 else -70)
    if 'eyeR' not in r and 'eyeL' in r: r['eyeR'] = shift(r['eyeL'], -70 if s < 0 else 70)
for a in VA:
    r = R[a]
    for p in ('eyeR', 'eyeL'):
        if p not in r: r[p] = list(R[nearest_with(p, a)][p])

def bb(P): return MO.bbox_pts(P)
def pivot(p, P):
    x0, y0, x1, y1 = bb(P)
    if p.startswith('wing'): return ((x0 + x1) / 2, y0 + 0.12 * (y1 - y0))
    if p.startswith('foot') or p.startswith('sole'): return ((x0 + x1) / 2, y1 - 12)
    if p == 'tuft': return ((x0 + x1) / 2, y1 - 8)
    if p in ('beak', 'eyeR', 'eyeL'): return ((x0 + x1) / 2, (y0 + y1) / 2)
    return ROOT
OWN = {'tw1': 'tuft', 'tw2': 'tuft', 'soleA': 'footA', 'soleB': 'footB', 'tuft_ink': 'tuft', 'wingA_ink': 'wingA', 'wingB_ink': 'wingB',
       'beak_ink': 'beak', 'tail_ink': 'tail', 'tail_inkT': 'tail', 'wingA_inkT': 'wingA', 'wingB_inkT': 'wingB', 'wingA_ink2': 'wingA', 'wingB_ink2': 'wingB', 'body_ink': 'body', 'body_fill': 'body'}   # parts that ride on another part's pivot

def verts(P, piv):
    n = len(P); out = []
    for i, (x, y) in enumerate(P):
        ax, ay = P[i - 1]; bx, by = P[(i + 1) % n]
        out.append([x - piv[0], y - piv[1], math.atan2(by - ay, bx - ax), math.hypot(bx - ax, by - ay) / 6])
    return out

WKEYS_45 = [-360 + 45 * i for i in range(17)]
# extra morph keys halfway between the official views. Linear everywhere, except the near wing at 67.5/112.5:
# there the official side-view wing (90) is slid toward its neighbour, so the wing never folds into a thin sliver.
def cen(P): return (sum(x for x, _ in P) / len(P), sum(y for _, y in P) / len(P))
for m in (22.5, 67.5, 112.5, 157.5):
    for sg in (1, -1):
        a = sg * m
        lo, hi = MO.vk(a - 22.5), MO.vk(a + 22.5)
        R[a] = {p: avg(R[lo][p], R[hi][p]) for p in R[lo] if p in R[hi]}
        if m in (67.5, 112.5):
            k = 'A' if sg > 0 else 'B'
            side = R[MO.vk(sg * 90)]
            ca, cs = cen(R[a]['wing' + k]), cen(side['wing' + k])
            for q in ('wing' + k, 'wing' + k + '_ink', 'wing' + k + '_inkT'):
                R[a][q] = shift(side[q], ca[0] - cs[0], ca[1] - cs[1])
# right-facing near wing = mirror of the left-facing one (official 14-16 wings do not point-match 10-12, they fold mid-turn)
for m in (45, 67.5, 90, 112.5, 135):
    src, dst = R[m], R[-m]
    cs, cd = cen(src['body_fill'])[0], cen(dst['body_fill'])[0]
    for q in ('wingA', 'wingA_ink', 'wingA_inkT'):
        P = [(cd - (x - cs), y) for x, y in src[q]]
        dst[q.replace('wingA', 'wingB')] = canon(P)
# the back tail curl is only drawn on top of the body (TailF, |angle| > 112.5). Below that, give its ink the 135 curl
# (slid to the tail) so it never morphs from the closed front ring into a blob.
for a in list(R):
    if abs(a) <= 112.5:
        src = R[135 if a >= 0 else -135]
        c1, c0 = cen(R[a]['tail']), cen(src['tail'])
        R[a]['tail_ink'] = shift(src['tail_ink'], c1[0] - c0[0], c1[1] - c0[1])
# near-wing line on top of the body: two official lines, never morphed into each other.
# ink  = the 3/4 outline (official 45), only slides for angles past 56;  ink2 = the side-view U (official 67.5/90),
# only slides for angles before 56. A hard switch at 56 picks one, so the line can never twist into a double line.
for sg, k in ((1, 'A'), (-1, 'B')):
    ink, ink2, wing = 'wing' + k + '_ink', 'wing' + k + '_ink2', 'wing' + k
    C, U = R[sg * 45], R[sg * 67.5]
    for a in list(R):
        cw = cen(R[a][wing])
        def slide(src):
            c0 = cen(src[wing]); return shift(src[q], cw[0] - c0[0], cw[1] - c0[1])
        if sg * a > 56:
            R[a][ink2] = list(R[a][ink]); q = ink; R[a][ink] = slide(C)
        else:
            q = ink; R[a][ink2] = shift(U[ink], cw[0] - cen(U[wing])[0], cw[1] - cen(U[wing])[1])
KEYA = [-360 + 22.5 * i for i in range(33)]
POSE = {}                          # key angle -> {part: (pivot, verts)}
for a in KEYA:
    r = R[MO.vk(a)]
    pose = {}
    for p, P in r.items():
        piv = pivot(OWN.get(p, p), r[OWN.get(p, p)])
        pose[p] = (piv, verts(P, piv))
    POSE[a] = pose
for p in NV:                       # unwrap each vertex's tangent angle along the key sequence (no spins between keys)
    for i in range(NV[p]):
        prev = None
        for a in KEYA:
            v = POSE[a][p][1][i]
            if prev is not None:
                while v[2] - prev > math.pi: v[2] -= 2 * math.pi
                while v[2] - prev < -math.pi: v[2] += 2 * math.pi
            prev = v[2]

VERT_IDS = {}                      # (shape name, i) -> id
SHAPE_PART = {}                    # shape name -> part
def mshape(name, part, clip=None, stroke=None):
    pose0 = POSE[0][part][1]
    vs = []
    for i, (x, y, rot, d) in enumerate(pose0):
        vid = nid(); VERT_IDS[(name, i)] = vid
        vs.append(f'<CubicMirroredVertex id="{vid}" x="{x:.2f}" y="{y:.2f}" rotation="{rot:.4f}" distance="{d:.2f}"/>')
    SHAPE_PART[name] = part
    sid = nid(); IDS[name] = sid
    th = stroke if stroke else STROKE.get(part)
    st = f'<Stroke thickness="{th}" cap="round" join="round"><SolidColor colorValue="{INKC}"/></Stroke>' if th else ''
    cl = f'<ClippingShape sourceId="{clip}" name="Clip"/>' if clip else ''
    return [f'<Shape name="{name}" id="{sid}" x="0" y="0"><PointsPath isClosed="true">{"".join(vs)}</PointsPath>'
            f'<Fill><SolidColor colorValue="{COL[part]}"/></Fill>{st}{cl}</Shape>']

T_PART = {}                        # turn node -> part whose pivot it follows
def tnode2(name, part, parent_abs, children, extra=''):
    piv0 = POSE[0][part][0]
    i = nid(); IDS[name] = i
    x, y = piv0[0] - parent_abs[0], piv0[1] - parent_abs[1]
    REST[name] = (x, y); T_PART[name] = (part, parent_abs)
    return [f'<Node name="{name}" id="{i}" x="{x:.2f}" y="{y:.2f}"{extra}>'] + children + ['</Node>']
def anode(name, children, extra=''):
    i = nid(); IDS[name] = i; REST[name] = (0, 0)
    return [f'<Node name="{name}" id="{i}" x="0" y="0"{extra}>'] + children + ['</Node>']

body_shape = mshape('Body Fill', 'body_fill') + mshape('Body Ink', 'body_ink')
BODY_SHAPE_ID = IDS['Body Fill']
# everything riding on the body lives under Body (pivot = feet anchor, ROOT); positions below are relative to ROOT
tuft = tnode2('Tuft T', 'tuft', ROOT, anode('TuftLag', anode('Tuft', mshape('Tuft Ink', 'tuft_ink') + mshape('Tuft W1', 'tw1') + mshape('Tuft W2', 'tw2') + mshape('Tuft Shape', 'tuft'))))
beak = tnode2('Beak T', 'beak', ROOT, anode('BeakLead', anode('Beak', mshape('Beak Shape', 'beak'))))
# side views: the beak sits UNDER the body so the body outline covers the beak's base stroke (boss 29 Oct)
beak_b = tnode2('BeakB T', 'beak', ROOT, anode('BeakB', mshape('BeakB Shape', 'beak')), ' opacity="0"')
wing_af = tnode2('WingAF T', 'wingA', ROOT, anode('WingAFLag', anode('WingAF', anode('WingAF InkC', mshape('WingAF Ink', 'wingA_ink')) + anode('WingAF InkU', mshape('WingAF Ink2', 'wingA_ink2'), ' opacity="0"') + mshape('WingAF Shape', 'wingA'))), ' opacity="0"')
wing_bf = tnode2('WingBF T', 'wingB', ROOT, anode('WingBFLag', anode('WingBF', anode('WingBF InkC', mshape('WingBF Ink', 'wingB_ink')) + anode('WingBF InkU', mshape('WingBF Ink2', 'wingB_ink2'), ' opacity="0"') + mshape('WingBF Shape', 'wingB'))), ' opacity="0"')
wing_ab = tnode2('WingAB T', 'wingA', ROOT, anode('WingALag', anode('WingA', mshape('WingAB Shape', 'wingA', stroke=INK_W))))
wing_bb = tnode2('WingBB T', 'wingB', ROOT, anode('WingBLag', anode('WingB', mshape('WingBB Shape', 'wingB', stroke=INK_W))))
tail_f = anode('TailF', mshape('TailF Ink2', 'tail_ink') + mshape('TailF Shape', 'tail'), ' opacity="0"')
tail_b = anode('TailB', mshape('TailB Shape', 'tail', stroke=INK_W))
eye_r = tnode2('EyeR T', 'eyeR', ROOT, anode('EyeRLead', anode('EyeR', mshape('EyeR Shape', 'eyeR'))))
eye_l = tnode2('EyeL T', 'eyeL', ROOT, anode('EyeLLead', anode('EyeL', mshape('EyeL Shape', 'eyeL'))))
belly = anode('Belly', mshape('Belly Shape', 'belly'))
face_id = nid()
face = [f'<Node name="Face" id="{face_id}" x="0" y="0">', f'<ClippingShape sourceId="{BODY_SHAPE_ID}" name="Clip"/>'] + eye_r + eye_l + mshape('Highlight Shape', 'hi') + belly + ['</Node>']
body = anode('Body', tuft + beak + wing_af + wing_bf + tail_f + face + body_shape + beak_b + tail_b + wing_ab + wing_bb)
def foot(nm, part, sole, extra=''):
    return tnode2(nm + ' T', part, ROOT, anode(nm, mshape(nm + ' Sole', sole) + mshape(nm + ' Shape', part)), extra)
foot_bf = foot('FootBF', 'footB', 'soleB', ' opacity="0"')
foot_a = foot('FootA', 'footA', 'soleA')
foot_b = foot('FootB', 'footB', 'soleB')
flip = node('Flip', ROOT, ROOT, body + foot_bf + foot_a + foot_b)

FONT = '0:90'
CITY_COLORS = [('Kochi', 'FF22A866'), ('Chennai', 'FFF07F1A'), ('Bengaluru', 'FF8A55D6'), ('London', 'FF2F78DE')]
def text(name, txt, size, color, x, y, bg=None, bind=None, font=FONT):
    sid = nid(); tid = nid()
    b = (f'<TextStyleBackground cornerRadius="{size * 0.5:g}" name="BG"><Fill name="F"><SolidColor colorValue="{bg}"/></Fill>'
         f'<Stroke thickness="7.5"><SolidColor colorValue="FF232323"/></Stroke></TextStyleBackground>') if bg else ''
    db = f'<DataBindContext sourcePathIds="{bind}" propertyKey="268"/>' if bind else ''
    return [f'<Text name="{name}" id="{tid}" x="{x:g}" y="{y:g}" sizingValue="autoWidth" originX="0.5" originY="0.5">',
            f'<TextStylePaint fontSize="{size:g}" lineHeight="{size * 1.5:g}" fontAssetId="{font}" name="Style" id="{sid}"><Fill name="Fill"><SolidColor colorValue="{color}"/></Fill>{b}</TextStylePaint>',
            f'<TextValueRun styleId="{sid}" text="{txt}" name="Run">{db}</TextValueRun>', '</Text>']

# name tag: one pill per flock colour, Solo picks by city. Text pads itself with spaces from the host.
tag_id = nid(); IDS['Tag'] = tag_id
tag = [f'<Solo name="Tag" id="{tag_id}" x="0" y="-690" activeComponentId="0:0">'.replace('activeComponentId="0:0"', ''),
       f'<DataBindContext sourcePathIds="{VM}-{VMP["city"]}" propertyKey="296"/>']
for cname, col in CITY_COLORS:
    tag += text(f'Tag {cname}', ' ducky ', 78, 'FFFFFFFF', 0, 0, bg=col, bind=f'{VM}-{VMP["name"]}')
tag += ['</Solo>']

# quack bubble beside the head, pops from its tail on the Quack timeline
emote = node('Emote', (610, 150), ROOT, text('Quack', 'Quack!', 70, 'FF232323', 0, -4) + [
    f'<Shape name="Bubble" id="{nid()}" x="0" y="0"><Rectangle width="330" height="150" cornerRadiusTL="75"/>'
    '<Fill><SolidColor colorValue="FFFFFFFF"/></Fill><Stroke thickness="7.5"><SolidColor colorValue="FF232323"/></Stroke></Shape>',
    f'<Shape name="Tail" id="{nid()}" x="-110" y="76"><PointsPath isClosed="true"><StraightVertex x="-10" y="-10"/><StraightVertex x="50" y="-10"/><StraightVertex x="-70" y="60"/></PointsPath>'
    '<Fill><SolidColor colorValue="FFFFFFFF"/></Fill><Stroke thickness="7.5" join="round"><SolidColor colorValue="FF232323"/></Stroke></Shape>',
    ], extra=' opacity="0"')

# player ring under the feet, shown when isPlayer = 1
ring = [f'<Shape name="You Ring" id="{nid()}" x="0" y="4" opacity="0">',
        f'<DataBindContext sourcePathIds="{VM}-{VMP["isPlayer"]}" propertyKey="18"/>',
        '<Ellipse width="470" height="110"/><Fill><SolidColor colorValue="40FF6B5B"/></Fill>',
        '<Stroke thickness="16"><SolidColor colorValue="FFFF6B5B"/></Stroke></Shape>']

root = node('Root', ROOT, ROOT, tag + emote + flip + ring)
# preview-only backdrop, hidden unless the host sets bg=1 (the component itself stays transparent)
backdrop = [f'<Shape name="Preview Backdrop" id="{nid()}" x="-3.5" y="-307.5" opacity="0">',
            f'<DataBindContext sourcePathIds="{VM}-{VMP["bg"]}" propertyKey="18"/>',
            '<Rectangle width="713" height="937"/><Fill><SolidColor colorValue="FFDCE9FA"/></Fill></Shape>']

# ---------- animation ----------
EASE = '<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>'
def kf(frame, value, ease=EASE):
    return f'<KeyFrameDouble frame="{frame}" value="{value:.4f}" interpolationType="cubic">{ease}</KeyFrameDouble>'
def kfl(frame, value):
    return f'<KeyFrameDouble frame="{frame}" value="{value:.4f}"/>'

KEYS = {'x': 13, 'y': 14, 'rot': 15, 'sx': 16, 'sy': 17, 'op': 18, 'vx': 24, 'vy': 25, 'vr': 82, 'vd': 83}
ALIAS = {'WingL': ['WingA', 'WingAF'], 'WingR': ['WingB', 'WingBF'], 'FootL': ['FootA'], 'FootR': ['FootB', 'FootBF']}
def anim(name, aid, dur, tracks, loop=1, linear=False, ids=None):
    """tracks: {(nodeName, prop): [(frame, value), ...]}; ids maps names that are not in IDS (vertices)"""
    by = {}
    for (n, p), ks in tracks.items():
        for n2 in ALIAS.get(n, [n]):
            by.setdefault(n2, []).append((p, ks))
    xml = [f'<LinearAnimation name="{name}" id="{aid}" duration="{dur}" fps="60" loopValue="{loop}">']
    for n, props in by.items():
        oid = IDS[n] if not isinstance(n, tuple) else VERT_IDS[n]
        xml.append(f'<KeyedObject objectId="{oid}">')
        for p, ks in props:
            xml.append(f'<KeyedProperty propertyKey="{KEYS[p]}">' + ''.join((kfl if linear else kf)(f, v) for f, v in ks) + '</KeyedProperty>')
        xml.append('</KeyedObject>')
    xml.append('</LinearAnimation>')
    return xml

REST['Emote'] = rel((610, 150), ROOT)
POS0 = dict(REST)
for n in ('FootL', 'FootR', 'WingL', 'WingR', 'Tuft', 'Beak', 'Body', 'EyeR', 'EyeL', 'Belly'):
    POS0[n] = (0, 0)
def tr(n, p, ks):
    if p in ('x', 'y'):
        b = POS0[n][0 if p == 'x' else 1]
        ks = [(f, b + v) for f, v in ks]
    return {(n, p): ks}
def merge(*ds):
    r = {}
    for d in ds: r.update(d)
    return r

# breathing (boss 30 Oct): slow, soft, a little longer exhale than inhale. Body grows up and narrows a touch on the
# in-breath; tuft and wings follow a few frames late so the breath travels through the Ducky.
BR = 220      # frames per breath at 60 fps (~3.7 s)
IDLE_DUR = 3 * BR   # three breaths per idle loop; the eyes look around during it
def breath(base):
    return [(base, 1), (base + 95, 1.024), (base + BR, 1)]
def series(fn):
    out = []
    for b in range(3): out += fn(b * BR)
    return sorted(dict(out).items())
# eye darts (boss 30 Oct, looking around): look left, hold, look right, hold, back. Quick move, slow hold.
LOOK = [(0, 0), (150, 0), (158, -16), (250, -16), (258, 0), (330, 0), (338, 14), (430, 14), (438, 0), (IDLE_DUR, 0)]
LOOKY = [(0, 0), (150, 0), (158, -2), (250, -2), (258, 0), (330, 0), (338, -3), (430, -3), (438, 0), (IDLE_DUR, 0)]
IDLE = merge(
    tr('Body', 'sy', series(lambda b: breath(b))),
    tr('Body', 'sx', series(lambda b: [(b, 1), (b + 95, 0.988), (b + BR, 1)])),
    tr('Body', 'y', series(lambda b: [(b, 0), (b + 95, -2.5), (b + BR, 0)])),
    tr('Tuft', 'rot', series(lambda b: [(b, 0), (b + 20, 0), (b + 115, 0.06), (b + BR, 0)])),
    tr('WingL', 'rot', series(lambda b: [(b, 0), (b + 12, 0), (b + 107, 0.025), (b + BR, 0)])),
    tr('WingR', 'rot', series(lambda b: [(b, 0), (b + 12, 0), (b + 107, -0.025), (b + BR, 0)])),
    tr('EyeR', 'x', LOOK), tr('EyeL', 'x', LOOK), tr('EyeR', 'y', LOOKY), tr('EyeL', 'y', LOOKY),
    # boss rule 30 Oct: when the eyes move, the beak moves with them (same dart, same timing)
    tr('Beak', 'x', LOOK), tr('Beak', 'y', LOOKY),
    # parallax: the tuft and belly patch lag behind and move less
    tr('Tuft', 'x', [(f, 0.35 * v) for f, v in LOOK]),
    tr('Belly', 'x', [(f, 0.25 * v) for f, v in LOOK]),
)
# blinking: its own layer, so the Ducky blinks while idle, walking and turning. A single blink, a long gap,
# then a quick double blink; eyes squash flat (scaleY) around their centre.
BLINK_DUR = 330
def blink_keys(t0):
    # softer blink: ease shut over 6 frames, hold 3, ease open over 8 with a tiny overshoot, then settle
    return [(t0, 1), (t0 + 6, 0.1), (t0 + 9, 0.1), (t0 + 17, 1.04), (t0 + 22, 1)]
BLINK = {}
for eye in ('EyeR T', 'EyeL T'):
    ks = [(0, 1)] + blink_keys(40) + blink_keys(200) + blink_keys(224) + [(BLINK_DUR, 1)]
    ks = sorted(dict(ks).items())
    BLINK[(eye, 'sy')] = ks
# ---------- walk styles (boss 29 Oct: improve the walk) ----------
# One cycle = two steps. Classic poses per step: contact (heel down) -> down (weight lands, squash, lowest)
# -> passing (other foot swings through, body highest, stretch) -> contact. Wings and tuft follow a few frames
# late (overlap), so the Ducky reads soft and alive instead of moving as one block.
STYLES = {
    'waddle': dict(W=44, bob=8, sway=12, wad=0.10, lean=0.07, lift=24, stride=22, sq=0.035, wing=0.07, tuft=0.12, lag=4),
    'bouncy': dict(W=34, bob=26, sway=8,  wad=0.07, lean=0.09, lift=34, stride=26, sq=0.09, wing=0.12, tuft=0.22, lag=4),
    'scurry': dict(W=36, bob=5,  sway=4,  wad=0.04, lean=0.13, lift=10, stride=12, sq=0.03, wing=0.05, tuft=0.08, lag=3),
}
def walk_for(deg, P):
    th = math.radians(deg); s, c = math.sin(th), math.cos(th); ac = abs(c)
    W = P['W']; H = W / 2
    def wave(t, keys):                      # keys over one step (0..1), smoothstep between keys, repeats every step
        u = (t % H) / H
        for (a_, va), (b_, vb) in zip(keys, keys[1:]):
            if a_ <= u <= b_:
                k = (u - a_) / (b_ - a_); k = k * k * (3 - 2 * k)
                return va + (vb - va) * k
        return keys[-1][1]
    grid = [g for g in range(0, W + 1, 2)]
    if grid[-1] != W: grid.append(W)
    # body: lowest just after contact, highest at passing
    BOB = [(0, 0.2), (0.18, 0.35), (0.5, -1.0), (0.82, -0.2), (1, 0.2)]
    SQY = [(0, -0.6), (0.18, -1.0), (0.5, 0.7), (0.82, 0.1), (1, -0.6)]
    body_y = [(g, P['bob'] * wave(g, BOB)) for g in grid]
    body_sy = [(g, 1 + P['sq'] * wave(g, SQY)) for g in grid]
    body_sx = [(g, 1 - 0.8 * P['sq'] * wave(g, SQY)) for g in grid]
    side = lambda t: math.cos(2 * math.pi * t / W)          # +1 on left-foot contact, -1 on right-foot contact
    body_x = [(g, -P['sway'] * ac * side(g)) for g in grid]
    body_r = [(g, P['lean'] * s - P['wad'] * ac * side(g)) for g in grid]
    def foot_(name, ph):
        def lift(t):                          # this foot swings during its half of the cycle
            u = ((t + ph) % W) / W
            return -math.sin(math.pi * u / 0.5) if u < 0.5 else 0.0
        def fwd(t):
            u = ((t + ph) % W) / W
            return -math.cos(math.pi * u / 0.5) if u < 0.5 else 1 - 2 * (u - 0.5) / 0.5
        return merge(tr(name, 'y', [(g, P['lift'] * lift(g) + P['stride'] * fwd(g) * c * 0.3) for g in grid]),
                     tr(name, 'x', [(g, P['stride'] * fwd(g) * s) for g in grid]),
                     tr(name, 'rot', [(g, 0.3 * s * lift(g)) for g in grid]))
    lag = P['lag']
    wing = lambda k, g: P['wing'] * (side(g - lag) * k * ac + 0.6 * s * side(g - lag))
    return merge(
        foot_('FootL', 0), foot_('FootR', H),
        tr('Body', 'y', body_y), tr('Body', 'x', body_x), tr('Body', 'rot', body_r),
        tr('Body', 'sy', body_sy), tr('Body', 'sx', body_sx),
        tr('WingL', 'rot', [(g, wing(1, g)) for g in grid]),
        tr('WingR', 'rot', [(g, wing(-1, g)) for g in grid]),
        tr('Tuft', 'rot', [(g, P['tuft'] * side(g - 2 * lag) * (0.6 + 0.4 * ac) - 0.5 * P['lean'] * s) for g in grid]),
    )
# quack (boss 30 Oct): anticipation squash, a big "QUA" with the bill wide open, a short chatter, then a smaller
# "ack" and close. The mouth opens by moving parts (lower bill drops, upper bill lifts), never by scaling the beak.
QUACK = merge(
    tr('Body', 'sy', [(0, 1), (8, 0.82), (16, 1.14), (28, 1.0), (34, 0.86), (44, 1.04), (52, 1), (75, 1)]),
    tr('Body', 'sx', [(0, 1), (8, 1.14), (16, 0.9), (28, 1.0), (34, 1.12), (44, 0.97), (52, 1), (75, 1)]),
    tr('Body', 'y', [(0, 0), (8, 0), (20, -70), (30, 0), (75, 0)]),
    tr('FootL', 'y', [(0, 0), (10, 0), (20, -40), (30, 0), (75, 0)]), tr('FootR', 'y', [(0, 0), (10, 0), (20, -40), (30, 0), (75, 0)]),
    tr('Beak', 'sx', [(0, 1), (14, 1), (18, 1.16), (30, 1.1), (38, 1), (75, 1)]),
    tr('Beak', 'sy', [(0, 1), (14, 1), (18, 1.22), (30, 1.14), (38, 1), (75, 1)]),
    tr('WingL', 'rot', [(0, 0), (8, -0.1), (18, 0.9), (34, 0.1), (75, 0)]), tr('WingR', 'rot', [(0, 0), (8, 0.1), (18, -0.9), (34, -0.1), (75, 0)]),
    tr('Tuft', 'rot', [(0, 0), (10, -0.2), (22, 0.25), (40, -0.1), (75, 0)]),
    tr('Emote', 'op', [(0, 0), (14, 0), (18, 1), (62, 1), (72, 0), (75, 0)]),
    tr('Emote', 'sx', [(0, 0.4), (14, 0.4), (22, 1.12), (28, 1), (62, 1), (72, 0.8), (75, 0.4)]),
    tr('Emote', 'sy', [(0, 0.4), (14, 0.4), (22, 1.12), (28, 1), (62, 1), (72, 0.8), (75, 0.4)]),
)
# dance (boss 30 Oct): a side-step bop on the beat. Hop and land with squash each beat, sway side to side, wings
# flap small (they stay on the body), feet alternate, tuft lags behind the body.
B = 24   # frames per beat
DANCE = merge(
    tr('Body', 'x', [(0, -16), (B, 16), (2 * B, -16)]),
    tr('Body', 'rot', [(0, -0.1), (4, -0.11), (B, 0.1), (B + 4, 0.11), (2 * B, -0.1)]),
    tr('Body', 'y', [(0, 0), (3, 4), (11, -24), (19, 0), (B, 0), (B + 3, 4), (B + 11, -24), (B + 19, 0), (2 * B, 0)]),
    tr('Body', 'sy', [(0, 0.92), (4, 0.9), (11, 1.06), (19, 0.97), (B, 0.92), (B + 4, 0.9), (B + 11, 1.06), (B + 19, 0.97), (2 * B, 0.92)]),
    tr('Body', 'sx', [(0, 1.06), (4, 1.08), (11, 0.96), (19, 1.02), (B, 1.06), (B + 4, 1.08), (B + 11, 0.96), (B + 19, 1.02), (2 * B, 1.06)]),
    tr('WingL', 'rot', [(0, 0.05), (8, 0.4), (16, 0.08), (B, 0.05), (B + 8, 0.25), (B + 16, 0.06), (2 * B, 0.05)]),
    tr('WingR', 'rot', [(0, -0.05), (8, -0.25), (16, -0.06), (B, -0.05), (B + 8, -0.4), (B + 16, -0.08), (2 * B, -0.05)]),
    tr('FootL', 'y', [(0, 0), (5, 0), (11, -22), (18, 0), (2 * B, 0)]), tr('FootR', 'y', [(0, 0), (B + 5, 0), (B + 11, -22), (B + 18, 0), (2 * B, 0)]),
    tr('FootL', 'rot', [(0, 0), (11, -0.18), (18, 0), (2 * B, 0)]), tr('FootR', 'rot', [(0, 0), (B + 11, 0.18), (B + 18, 0), (2 * B, 0)]),
    tr('Tuft', 'rot', [(0, 0.16), (6, 0.2), (B, -0.16), (B + 6, -0.2), (2 * B, 0.16)]),
)
WKEYS = WKEYS_45
WALKS = {st: [walk_for(d, P) for d in WKEYS] for st, P in STYLES.items()}
ALL = {}
for d in [IDLE, QUACK, DANCE] + [w for ws in WALKS.values() for w in ws]:
    ALL.update({k: None for k in d})
def fill(d, dur):
    r = dict(d)
    for (n, p) in ALL:
        if (n, p) not in r:
            v = 1 if p in ('sx', 'sy') else 0
            if n == 'Emote' and p in ('op', 'sx', 'sy'):
                v = 0 if p == 'op' else 0.4
            if p in ('x', 'y'):
                v = POS0[n][0 if p == 'x' else 1]
            r[(n, p)] = [(0, v), (dur, v)]
    return r

# ---------- turn: morph keys (every 45 deg) + layer switches (fine) ----------
morph_anims = []
for i, a in enumerate(KEYA):
    pose = POSE[a]; tracks = {}
    for nm, (part, pabs) in T_PART.items():
        piv = pose[part][0]
        tracks[(nm, 'x')] = [(0, piv[0] - pabs[0])]; tracks[(nm, 'y')] = [(0, piv[1] - pabs[1])]
    for (shp, vi), vid in VERT_IDS.items():
        x, y, rot, d = pose[SHAPE_PART[shp]][1][vi]
        tracks[((shp, vi), 'vx')] = [(0, x)]; tracks[((shp, vi), 'vy')] = [(0, y)]
        tracks[((shp, vi), 'vr')] = [(0, rot)]; tracks[((shp, vi), 'vd')] = [(0, d)]
    morph_anims += anim(f'Morph {a}', f'8:{600 + i}', 1, tracks, linear=True)

def ramp(x, a, b):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t
def layer_pose(a):
    w = MO.wrapd(a)
    return {
        ('WingAF T', 'op'): ramp(w, 9, 11) * (1 - ramp(w, 169, 171)),
        ('WingBF T', 'op'): ramp(-w, 9, 11) * (1 - ramp(-w, 169, 171)),
        # only one copy of a wing at a time, or its outer edge shows two outlines side by side
        ('WingAF InkU', 'op'): ramp(w, 55.5, 56.5), ('WingAF InkC', 'op'): 1 - ramp(w, 55.5, 56.5),
        ('WingBF InkU', 'op'): ramp(-w, 55.5, 56.5), ('WingBF InkC', 'op'): 1 - ramp(-w, 55.5, 56.5),
        ('WingAB T', 'op'): 1 - ramp(w, 9, 11) * (1 - ramp(w, 169, 171)),
        ('WingBB T', 'op'): 1 - ramp(-w, 9, 11) * (1 - ramp(-w, 169, 171)),
        ('TailF', 'op'): ramp(abs(w), 112.4, 112.6),
        ('Beak T', 'op'): (1 - ramp(abs(w), 74.9, 75.1)) * (1 - ramp(abs(w), 99, 101)),
        ('BeakB T', 'op'): ramp(abs(w), 74.9, 75.1) * (1 - ramp(abs(w), 99, 101)),
        ('EyeR T', 'op'): (1 - ramp(abs(w), 100, 108)) * (1 - ramp(-w, 51.9, 52.1)),
        ('EyeL T', 'op'): (1 - ramp(abs(w), 100, 108)) * (1 - ramp(w, 51.9, 52.1)),
        ('Belly', 'op'): 1 - ramp(abs(w), 100, 108),
        ('FootBF T', 'op'): ramp(-w, 1, 3) * (1 - ramp(-w, 177, 179)),
    }
LKEYS = sorted({round(-360 + 0.5 * i, 2) for i in range(1441)} & set())   # placeholder, replaced below
breaks = []
for base_a in range(-360, 361, 360):
    for b in (1, 3, 9, 11, 45, 51.9, 52.1, 55.5, 56.5, 74.9, 75.1, 99, 101, 100, 108, 112.4, 112.6, 169, 171, 177, 179):
        for sgn in (1, -1):
            for v_ in (base_a + sgn * b,):
                if -360 <= v_ <= 360: breaks.append(v_)
for base_a in range(-360, 361, 180): breaks.append(base_a)
LKEYS = sorted(set(round(b_, 2) for b_ in breaks if -360 <= b_ <= 360))
layer_anims = []
for i, a in enumerate(LKEYS):
    layer_anims += anim(f'Layers {a:g}', f'8:{1000 + i}', 1, {k: [(0, v)] for k, v in layer_pose(a).items()}, linear=True)

ANIMS = [('Idle', '0:20', IDLE_DUR, IDLE), ('Quack', '0:22', 75, QUACK), ('Dance', '0:23', 48, DANCE)]
anims = []
for nm, aid, dur, d in ANIMS:
    anims += anim(nm, aid, dur, fill(d, dur))
STYLE_BASE = {'waddle': 500, 'bouncy': 700, 'scurry': 800}
for st, ws in WALKS.items():
    Wst = STYLES[st]['W']
    for i, (a, d) in enumerate(zip(WKEYS, ws)):
        anims += anim(f'Walk {st} {a}', f'8:{STYLE_BASE[st] + i}', Wst, fill(d, Wst))
anims += morph_anims + layer_anims
anims += anim('Blink', '8:1500', BLINK_DUR, BLINK)
def lag_pose(k):
    return {('EyeRLead', 'x'): [(0, 10 * k)], ('EyeLLead', 'x'): [(0, 10 * k)],
            ('TuftLag', 'x'): [(0, -7 * k)], ('TuftLag', 'rot'): [(0, -0.14 * k)],
            ('WingAFLag', 'rot'): [(0, -0.09 * k)], ('WingBFLag', 'rot'): [(0, -0.09 * k)],
            ('WingALag', 'rot'): [(0, -0.09 * k)], ('WingBLag', 'rot'): [(0, -0.09 * k)]}
for i, k in enumerate((-1, 0, 1)):
    anims += anim(f'Lag {k}', f'8:{1510 + i}', 1, lag_pose(k), linear=True)

# ---------- state machine ----------
STATE = {0: '0:30', 1: '0:31', 2: '0:32', 3: '0:33', 4: '0:34', 5: '0:35'}
def cond(k):
    return (f'<TransitionViewModelCondition><TransitionPropertyViewModelComparator><BindablePropertyNumber>'
            f'<DataBindContext sourcePathIds="{VM}-{VMP["action"]}" propertyKey="636"/></BindablePropertyNumber>'
            f'</TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="{k}"/></TransitionViewModelCondition>')
TURN_BIND = f'<BindablePropertyNumber><DataBindContext sourcePathIds="{VM}-{VMP["turn"]}" propertyKey="636"/></BindablePropertyNumber>'
def trans(k, blend=False):
    tag = 'BlendStateTransition' if blend else 'StateTransition'
    return [f'<{tag} stateToId="{STATE[j]}" duration="160">{cond(j)}</{tag}>' for j in STATE if j != k]
sm = ['<StateMachine name="Ducky" id="0:7"><StateMachineLayer name="Action">',
      '<AnyState x="0" y="-200"/><ExitState x="900" y="-200"/>',
      f'<EntryState x="-200" y="0"><StateTransition stateToId="{STATE[0]}"/></EntryState>']
sm += [f'<AnimationState id="{STATE[0]}" animationId="0:20" x="0" y="0">'] + trans(0) + ['</AnimationState>']
for k_, st, xx in ((1, 'waddle', 220), (4, 'bouncy', 220), (5, 'scurry', 220)):
    sm += [f'<BlendState1DViewModel id="{STATE[k_]}" x="{xx}" y="{(k_ - 1) * 60}">', TURN_BIND]
    sm += [f'<BlendAnimation1D animationId="8:{STYLE_BASE[st] + i}" value="{a + 360:g}"/>' for i, a in enumerate(WKEYS)]
    sm += trans(k_, blend=True) + ['</BlendState1DViewModel>']
sm += [f'<AnimationState id="{STATE[2]}" animationId="0:22" x="440" y="0">'] + trans(2) + ['</AnimationState>']
sm += [f'<AnimationState id="{STATE[3]}" animationId="0:23" x="660" y="0">'] + trans(3) + ['</AnimationState>']
sm.append('</StateMachineLayer>')
SPIN_BIND = f'<BindablePropertyNumber><DataBindContext sourcePathIds="{VM}-{VMP["spin"]}" propertyKey="636"/></BindablePropertyNumber>'
sm += ['<StateMachineLayer name="Lag">', '<AnyState x="0" y="-200"/><ExitState x="400" y="-200"/>',
       '<EntryState x="-200" y="0"><StateTransition stateToId="0:36"/></EntryState>',
       '<BlendState1DViewModel id="0:36" x="200" y="0">', SPIN_BIND]
sm += [f'<BlendAnimation1D animationId="8:{1510 + i}" value="{k}"/>' for i, k in enumerate((-1, 0, 1))]
sm += ['</BlendState1DViewModel>', '</StateMachineLayer>']
sm += ['<StateMachineLayer name="Blink">', '<AnyState x="0" y="-200"/><ExitState x="400" y="-200"/>',
       '<EntryState x="-200" y="0"><StateTransition stateToId="0:37"/></EntryState>',
       '<AnimationState id="0:37" animationId="8:1500" x="200" y="0"></AnimationState>', '</StateMachineLayer>']
for lname, sid, keys_, base_id in (('Morph', '0:38', KEYA, 600), ('Layers', '0:39', LKEYS, 1000)):
    sm += [f'<StateMachineLayer name="{lname}">', '<AnyState x="0" y="-200"/><ExitState x="400" y="-200"/>',
           f'<EntryState x="-200" y="0"><StateTransition stateToId="{sid}"/></EntryState>',
           f'<BlendState1DViewModel id="{sid}" x="200" y="0">', TURN_BIND]
    sm += [f'<BlendAnimation1D animationId="8:{base_id + i}" value="{a + 360:g}"/>' for i, a in enumerate(keys_)]
    sm += ['</BlendState1DViewModel>', '</StateMachineLayer>']
sm.append('</StateMachine>')

# ---------- document ----------
vm = [f'<ViewModel name="DuckyVM" id="{VM}" defaultInstanceId="{VMI}">']
vm += [f'<ViewModelProperty{"String" if k in STRINGS else "Number"} name="{k}" id="{v}"/>' for k, v in VMP.items()]
vm.append(f'<ViewModelInstance name="Default" id="{VMI}" exports="true">')
def vm_values(vals, extra_inst=''):
    out = []
    for k, v in VMP.items():
        if k in STRINGS:
            out.append(f'<ViewModelInstanceString viewModelPropertyId="{v}" propertyValue="{vals.get(k, " ducky ")}"/>')
        else:
            out.append(f'<ViewModelInstanceNumber viewModelPropertyId="{v}" propertyValue="{vals.get(k, {'facing': 1, 'turn': 360}.get(k, 0))}"/>')
    return out
vm += vm_values({})
vm += ['</ViewModelInstance>']
SLOT_INSTANCES = [f'0:{70 + k}' for k in range(16)]
for k, iid in enumerate(SLOT_INSTANCES):
    vm += [f'<ViewModelInstance name="Slot {k}" id="{iid}" exports="true">'] + vm_values({}) + ['</ViewModelInstance>']
vm += ['</ViewModel>']

doc = ['<Rive version="1" kind="fragment">',
       f'<Artboard name="Ducky" id="0:2" isComponent="true" clip="false" width="713" height="937" originX="{360/713:.5f}" originY="{776/937:.5f}" x="0" y="1400" styleId="0:3" defaultStateMachineId="0:7" viewModelId="{VM}" viewModelInstanceId="{VMI}">',
       '<LayoutComponentStyle name="Artboard Style" id="0:3"/>']
doc += sm + root + backdrop + anims + ['</Artboard>'] + vm + [f'<FontAsset file="fonts/Gilroy-Black.ttf" name="Gilroy Black" id="{FONT}"/>', '</Rive>']
open(os.path.join(HERE, 'scene.rml'), 'w').write('\n'.join(doc))
print('wrote scene.rml', sum(len(l) for l in doc) // 1024, 'KB')
