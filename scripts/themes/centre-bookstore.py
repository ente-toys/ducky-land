# Library island: the round bookstore tower and its ring of book stalls (boss lock, concepts/themes/library-base/
# library-two-isles-3.png, right landmass). Called by centre-build.py, which passes its helpers in `ns`.
# Origin (0,0) = centre of the tower's base on the ground. Everything in world units, screen = walk coordinates.
import math
import numpy as np

def build(ns):
    K, Piece, entry, traced, ell, fill, gd, box, shape_json, unary_union = (ns[k] for k in
        ('K', 'Piece', 'entry', 'traced', 'ell', 'fill', 'gd', 'box', 'shape_json', 'unary_union'))
    T = 'library'
    PAVE, LINE, SHADE, GRASS_D = '#F7E6AF', '#E2CC8C', '#E4C567', '#7DAE30'
    CR = 1080                                    # forecourt radius (plan)
    out = dict(name='Round bookstore tower', concept='concepts/themes/library-base/library-two-isles-3.png',
               origin='centre of the tower base on the ground', folder='bookstore/', pieces=[])

    # decal: round forecourt, ring paving (the island's tower-garden style) with radial joints
    d = Piece(T, 'bookstore/decal-forecourt', 'Bookstore forecourt paving')
    rx, ry = CR, CR * K
    d.add(f'<ellipse cx="0" cy="0" rx="{rx + 12}" ry="{ry + 12:.1f}" fill="{GRASS_D}"/>', ell(0, 0, rx + 14, ry + 14))
    d.add(f'<ellipse cx="0" cy="0" rx="{rx + 6}" ry="{ry + 6:.1f}" fill="{SHADE}"/>')
    d.add(f'<ellipse cx="0" cy="0" rx="{rx}" ry="{ry:.1f}" fill="{PAVE}" stroke="{LINE}" stroke-width="5"/>')
    js = []
    for q in (.42, .58, .74, .9):
        js.append(f'M{rx * q:.1f} 0 A{rx * q:.1f} {ry * q:.1f} 0 1 0 {-rx * q:.1f} 0 A{rx * q:.1f} {ry * q:.1f} 0 1 0 {rx * q:.1f} 0')
    for i, (q0, q1, n) in enumerate([(.42, .58, 20), (.58, .74, 26), (.74, .9, 32), (.9, 1, 38)]):
        for k in range(n):
            t = 2 * math.pi * (k + .5 * (i % 2)) / n
            js.append(f'M{math.cos(t) * rx * q0:.1f} {math.sin(t) * ry * q0:.1f} L{math.cos(t) * rx * q1:.1f} {math.sin(t) * ry * q1:.1f}')
    d.add(f'<path d="{" ".join(js)}" stroke="{LINE}" stroke-width="4" fill="none"/>')
    d.add(f'<ellipse cx="{-rx * .25:.1f}" cy="{-ry * .35:.1f}" rx="{rx * .4:.1f}" ry="{ry * .22:.1f}" fill="#FFFFFF" fill-opacity="0.16"/>')
    d.write()
    out['pieces'].append(entry(d, 'decal', id='bookstore-decal-forecourt'))

    # tower: base front edge measured from the art
    w, h, im = traced(T, 'bookstore/tower')
    al = im[..., 3] > 0
    bottom = np.where(al.any(1))[0].max()
    bw = max(np.ptp(np.where(al[y])[0]) for y in range(int(h * .82), bottom))
    base_rx = bw / 2; base_ry = base_rx * K
    ay = (bottom + 1) / h
    at = (0, base_ry)                            # front edge of the base; base centre = origin
    out['pieces'].append(dict(id='bookstore-tower', file='bookstore/tower.svg', layer='sorted', width=round(w, 1), height=round(h, 1),
                              anchor=dict(x=.5, y=round(ay, 4)), at=[0, round(at[1], 1)], x=round(-w / 2, 1), y=round(at[1] - ay * h, 1),
                              sortY=round(at[1], 1), note='landmark, sorted by its base front edge'))
    # stalls: a ring round the forecourt, leaving the door lane (front) and the back clear
    stalls = []
    ring_r = CR * .80
    angles = [200, 240, 300, 340, 25, 155]                      # screen degrees, 90 = front (the door lane)
    colours = ['red', 'green', 'blue', 'yellow', 'red', 'blue']
    for i, (a, c) in enumerate(zip(angles, colours)):
        t = math.radians(a)
        x, y = ring_r * math.cos(t), ring_r * K * math.sin(t)
        sw, sh, sim = traced(T, f'bookstore/stall-{c}')
        sal = sim[..., 3] > 0; sb = np.where(sal.any(1))[0].max()
        flip = x > 0
        say = (sb + 1) / sh
        stalls.append(dict(id=f'bookstore-stall-{i + 1}', file=f'bookstore/stall-{c}.svg', layer='sorted', flip=flip, width=round(sw, 1), height=round(sh, 1),
                           anchor=dict(x=.5, y=round(say, 4)), at=[round(x, 1), round(y, 1)], x=round(x - sw / 2, 1), y=round(y - say * sh, 1), sortY=round(y, 1)))
    out['pieces'] += stalls

    tower_fp = ell(0, 0, base_rx + 10)
    stall_fp = [ell(s['at'][0], s['at'][1] - 40, 115, 60) for s in stalls]
    out['door'] = dict(point=[0, round(base_ry + 40, 1)], facing='south', note='stand here to enter; the door is the yellow arch at the front of the base')
    out['outerEdge'] = dict(x=0, y=0, rx=CR, ry=round(CR * K, 1))
    out['walkable'] = [dict(ellipse=dict(x=0, y=0, rx=CR - 20, ry=round((CR - 20) * K, 1)))]
    out['blocked'] = [dict(name='bookstore tower', ellipse=dict(x=0, y=0, rx=round(base_rx + 10, 1), ry=round((base_rx + 10) * K, 1)))] + \
                     [dict(name=s['id'], ellipse=dict(x=s['at'][0], y=round(s['at'][1] - 40, 1), rx=115, ry=60)) for s in stalls]
    walk = ell(0, 0, CR - 20).difference(unary_union([tower_fp] + stall_fp))
    out['capacity'] = dict(area=round(walk.area), duckies=int(walk.area / ns['DUCK_AREA']))
    out['size'] = dict(towerWidth=round(w, 1), towerHeight=round(h, 1), note='Grand Reading Hall is 1342 x 892 as placed, the museum-size landmark')
    return out
