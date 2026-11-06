# Home-weight deck geometry copied from sunflower-build.py.
import numpy as np, math
ARCH_RISE=64
def polyd(ps): return 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in ps) + ' Z'

def deck_svg(name, a, b, w, rails):
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); ux, uy = dx/L, dy/L; nx, ny = -uy, ux
    hw = w / 2
    corner = lambda t, s: (a[0] + ux*t + nx*s, a[1] + uy*t + ny*s)
    body = [corner(0, -hw), corner(L, -hw), corner(L, hw), corner(0, hw)]
    side = 16   # the deck's visible thickness, dropped straight down (3/4 view)
    xs = [p[0] for p in body]; ys = [p[1] for p in body]
    pad = 40; x0, y0, x1, y1 = min(xs)-pad, min(ys)-pad, max(xs)+pad, max(ys)+pad+side+30
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {x1-x0:.1f} {y1-y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" stroke-linejoin="round" stroke-linecap="round">',
         f'<title>Puddlelace {name}</title>']
    sh = [(p[0]+14, p[1]+side+22) for p in body]
    s.append(f'<path d="{polyd(sh)}" fill="#2E7F93" fill-opacity=".28"/>')
    low = [(p[0], p[1]+side) for p in body]
    s.append(f'<path d="{polyd(low)}" fill="#8B5A2E" stroke="#39472D" stroke-width="3"/>')
    # posts under the deck
    for t in np.arange(30, L, 150):
        for sgn in (-1, 1):
            px, py = corner(t, sgn*(hw-8))
            s.append(f'<rect x="{px-7:.1f}" y="{py:.1f}" width="14" height="{side+34}" rx="3" fill="#7A4E28" stroke="#39472D" stroke-width="2.5"/>')
            s.append(f'<ellipse cx="{px:.1f}" cy="{py+side+34:.1f}" rx="14" ry="5" fill="none" stroke="#FFF0C7" stroke-width="2.5" stroke-opacity=".8"/>')
    s.append(f'<path d="{polyd(body)}" fill="#C8893F" stroke="#39472D" stroke-width="3.2"/>')
    # planks across the deck
    for t in np.arange(26, L, 26):
        p, q = corner(t, -hw+4), corner(t, hw-4)
        s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#39472D" stroke-width="1.6" stroke-opacity=".55"/>')
    # a lit edge and a few grain ticks
    p, q = corner(4, -hw+6), corner(L-4, -hw+6)
    s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#E9B46A" stroke-width="5" stroke-opacity=".8"/>')
    for i, t in enumerate(np.arange(40, L, 95)):
        p = corner(t + 8, (i % 3 - 1) * hw * .45); q = (p[0] + nx*14, p[1] + ny*14)
        s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#8B5A2E" stroke-width="2"/>')
    if rails:
        for sgn in (-1, 1):
            tops = []
            for t in np.linspace(20, L-20, max(2, int(L // 110) + 1)):
                px, py = corner(t, sgn*(hw-6)); tops.append((px, py-34))
                s.append(f'<rect x="{px-6:.1f}" y="{py-36:.1f}" width="12" height="38" rx="3" fill="#B97A3A" stroke="#39472D" stroke-width="2.5"/>')
            s.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in tops)}" fill="none" stroke="#39472D" stroke-width="10"/>')
            s.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in tops)}" fill="none" stroke="#C8893F" stroke-width="5"/>')
    else:   # jetties: two mooring bollards at the tip
        for sgn in (-1, 1):
            px, py = corner(L-14, sgn*(hw-10))
            s.append(f'<rect x="{px-9:.1f}" y="{py-30:.1f}" width="18" height="32" rx="6" fill="#7A4E28" stroke="#39472D" stroke-width="2.5"/><ellipse cx="{px:.1f}" cy="{py-30:.1f}" rx="9" ry="4" fill="#B97A3A" stroke="#39472D" stroke-width="2"/>')
    s.append('</svg>')
    open(f'{ART}/{name}.svg', 'w').write('\n'.join(s))
    return dict(src=f'{name}.svg', x=round(x0, 1), y=round(y0, 1), width=round(x1-x0, 1), height=round(y1-y0, 1))

def arch_svg(name, a, b, w, R=ARCH_RISE):
    """a humped footbridge in home's look: planked deck rising R at mid-span, side boards, railings on posts, stone footings"""
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); ux, uy = dx/L, dy/L; nx, ny = -uy, ux
    hw = w / 2; lift = lambda t: R * 4 * (t/L) * (1 - t/L)
    P = lambda t, sd, extra=0: (a[0] + ux*t + nx*sd, a[1] + uy*t + ny*sd - lift(t) - extra)
    ts = np.linspace(0, L, 28)
    vis = 1 if ny > 0 else -1          # the deck edge nearer the camera (lower on screen) shows its side boards
    left = [P(t, -hw) for t in ts]; right = [P(t, hw) for t in ts]
    deck = left + right[::-1]
    side = 20
    near = [P(t, vis*hw) for t in ts]; band = near + [(x, y + side) for x, y in near[::-1]]
    pts = deck + [(x, y + side + 40) for x, y in near]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    pad = 50; x0, y0, x1, y1 = min(xs)-pad, min(ys)-pad-50, max(xs)+pad, max(ys)+pad+40
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {x1-x0:.1f} {y1-y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" stroke-linejoin="round" stroke-linecap="round">',
         f'<title>Puddlelace {name}, humped footbridge</title>']
    flat = [(a[0] + ux*t + nx*sd + 16, a[1] + uy*t + ny*sd + 34) for t, sd in [(0, -hw), (L, -hw), (L, hw), (0, hw)]]
    o.append(f'<path d="{polyd(flat)}" fill="#2E7F93" fill-opacity=".26"/>')   # shadow on the water
    # the open arch under the span: the side boards hang over a dark gap down to the waterline
    under = [(x, y + side) for x, y in near] + [(a[0] + ux*t + nx*vis*hw, a[1] + uy*t + ny*vis*hw + side + 8) for t in ts[::-1]]
    o.append(f'<path d="{polyd(under)}" fill="#3F8FA0" fill-opacity=".55"/>')
    o.append(f'<path d="{polyd(band)}" fill="#8B5A2E" stroke="#39472D" stroke-width="3"/>')
    o.append(f'<path d="{polyd(deck)}" fill="#C8893F" stroke="#39472D" stroke-width="3"/>')
    for t in np.arange(22, L - 10, 22):
        p, q = P(t, -hw + 4), P(t, hw - 4)
        o.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#39472D" stroke-width="1.5" stroke-opacity=".5"/>')
    lit = [P(t, -vis*(hw - 7)) for t in ts]
    o.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in lit)}" fill="none" stroke="#E9B46A" stroke-width="5" stroke-opacity=".8"/>')
    for t in (6, L - 6):   # cream stone footings where the arch meets land
        for sd in (-hw, hw):
            x, y = P(t, sd); o.append(f'<ellipse cx="{x:.1f}" cy="{y + side + 4:.1f}" rx="16" ry="9" fill="#FFF0C7" stroke="#39472D" stroke-width="2.4"/>')
    for sgn in (-1, 1):   # railings: posts, then a rail that follows the hump
        posts = np.linspace(14, L - 14, max(3, int(L // 70) + 1)); tops = []
        for t in posts:
            x, y = P(t, sgn*(hw - 6)); tops.append((x, y - 36))
            o.append(f'<rect x="{x-6:.1f}" y="{y-38:.1f}" width="12" height="40" rx="3" fill="#B97A3A" stroke="#39472D" stroke-width="2.4"/>')
        rail = [P(t, sgn*(hw - 6), 36) for t in np.linspace(14, L - 14, 24)]
        d = 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in rail)
        o.append(f'<path d="{d}" fill="none" stroke="#39472D" stroke-width="10"/><path d="{d}" fill="none" stroke="#C8893F" stroke-width="5"/>')
        for x, y in tops: o.append(f'<rect x="{x-8:.1f}" y="{y-6:.1f}" width="16" height="8" rx="3" fill="#7A4E28" stroke="#39472D" stroke-width="2"/>')
    o.append('</svg>')
    open(f'{ART}/{name}.svg', 'w').write('\n'.join(o))
    return dict(src=f'{name}.svg', x=round(x0, 1), y=round(y0, 1), width=round(x1-x0, 1), height=round(y1-y0, 1))