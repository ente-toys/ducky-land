import re, sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from field import D
SRC = '.home-grow/orig/'; DST = 'public/pixi-art/'
ref = open(SRC + 'ground-r0-c0.svg').read()
def dof(name):
    i = ref.find('data-name="%s"' % name); return re.search(r'd="([^"]+)"', ref[i:]).group(1)
TARGETS = {dof('Shallow coast water'): (0, 50), dof('Sandy coast'): (0, 32), dof('Island grass'): (0, 0)}
num = r'-?\d+(?:\.\d+)?'
def move_path(d, tx, ty):
    # cubic segments that move are first split exactly (de Casteljau) into pieces of about 40 units, so the displaced curve
    # stays smooth; segments that do not move keep their original numbers
    toks = re.findall(r'[MCLZ]|' + num, d); out = []; i = 0; cur = None; start = None
    f = lambda x, y: ('%.3f %.3f' % (x + D(x + tx, y + ty)[0], y + D(x + tx, y + ty)[1]))
    moved = lambda pts: any(abs(D(x + tx, y + ty)[0]) > .01 or abs(D(x + tx, y + ty)[1]) > .01 for x, y in pts)
    while i < len(toks):
        t = toks[i]
        if t == 'M':
            cur = start = (float(toks[i + 1]), float(toks[i + 2])); out.append('M ' + (f(*cur) if moved([cur]) else '%s %s' % (toks[i + 1], toks[i + 2]))); i += 3
        elif t == 'C':
            raw = toks[i + 1:i + 7]; p = [cur] + [(float(raw[k]), float(raw[k + 1])) for k in (0, 2, 4)]
            if not moved(p + [((p[0][0] + p[3][0]) / 2, (p[0][1] + p[3][1]) / 2)]):
                out.append('C ' + ' '.join(raw))
            else:
                L = sum(((p[k + 1][0] - p[k][0]) ** 2 + (p[k + 1][1] - p[k][1]) ** 2) ** .5 for k in range(3)); n = max(1, int(L // 40))
                seg = p
                for k in range(n, 0, -1):   # peel off 1/k of what is left each time
                    u = 1.0 / k; a, b, c, e = seg
                    lerp = lambda P, Q: (P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u)
                    ab, bc, ce = lerp(a, b), lerp(b, c), lerp(c, e); abc, bce = lerp(ab, bc), lerp(bc, ce); m = lerp(abc, bce)
                    out.append('C %s %s %s' % (f(*ab), f(*abc), f(*m))); seg = (m, bce, ce, e)
            cur = p[3]; i += 7
        elif t == 'Z': out.append('Z'); cur = start; i += 1
        else: raise SystemExit('unexpected ' + t)
    return ' '.join(out)
NEW = {d: move_path(d, *t) for d, t in TARGETS.items()}
def move_tick(m):
    d = m.group(1); pts = list(map(float, re.findall(num, d)))
    cx = sum(pts[0::2]) / (len(pts) / 2); cy = sum(pts[1::2]) / (len(pts) / 2); dx, dy = D(cx, cy)
    if abs(dx) < .5 and abs(dy) < .5: return m.group(0)
    nd = re.sub(r'(' + num + r') (' + num + r')', lambda q: '%.3f %.3f' % (float(q.group(1)) + dx, float(q.group(2)) + dy), d)
    return m.group(0).replace(d, nd)
for f in sorted(os.listdir(SRC)):
    s = open(SRC + f).read(); n = 0
    for d, nd in NEW.items():
        n += s.count('d="%s"' % d); s = s.replace('d="%s"' % d, 'd="%s"' % nd)
    # offshore wave ticks (straight 3-wide strokes) and sea ripples ride the same field
    s = re.sub(r'<path d="(M [^"]{10,60})" fill="none" stroke="#FFF0C7" stroke-width="3"', move_tick, s)
    s = re.sub(r'(?<=data-name="Sea ripple" opacity="1">)\s*<path d="([^"]+)"', move_tick, s)
    open(DST + f, 'w').write(s); print(f, 'coast paths', n)
# new lawn patches on the added land, copies of home's own Lawn Leaf / Lawn Cream / Meadow shapes (same colours and opacity)
src = open(SRC + 'ground-r1-c1.svg').read()
def lawn(name):
    m = re.search(r'<path data-name="%s" d="([^"]+)"[^>]*/>' % name, src); d = m.group(1)
    p = list(map(float, re.findall(num, d))); return m.group(0), (min(p[0::2]) + max(p[0::2])) / 2, (min(p[1::2]) + max(p[1::2])) / 2
ADD = [('Lawn Leaf 03', 640, 1150, 'Lawn Leaf 20'), ('Lawn Cream 15', 2750, 480, 'Lawn Cream 21'), ('Lawn Leaf 05', 4150, 650, 'Lawn Leaf 22'),
       ('Lawn Leaf 06', 540, 1480, 'Lawn Leaf 23'), ('Lawn Cream 17', 500, 2200, 'Lawn Cream 24')]
extra = ''
for name, x, y, new in ADD:
    el, cx, cy = lawn(name)
    extra += el.replace('data-name="%s"' % name, 'data-name="%s"' % new).replace(' />', ' transform="matrix(1 0 0 1 %.1f %.1f)" />' % (x - cx, y - cy)).replace('/>', '/>', 1) + '\n'
for f in sorted(os.listdir(SRC)):
    s = open(DST + f).read(); k = s.find('<g data-name="Round 4 two-tone lawns">')
    if k < 0: print('no lawns group', f); continue
    k = s.find('>', k) + 1
    open(DST + f, 'w').write(s[:k] + extra + s[k:])
