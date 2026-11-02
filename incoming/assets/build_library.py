#!/usr/bin/env python3
"""Hand-authored Ducky Land vector library. No image generation or tracing.

Run with the Python 3.12 listed in requirements/run.sh. PathOps only computes
exact Bezier intersections and expands the measured 7.5-unit ink contours.
"""
from __future__ import annotations
import sys, math, json, re, copy, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.deps'))
import pathops as po
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

INK = '#232323'
T = 7.5
PAL = {
    'yellow':('#F4D93B','#F2BA3D'), 'orange':('#FF814A','#D9573A'),
    'leaf':('#58BF43','#3E9F2F'), 'grass':('#8ED66B','#6CC24E'),
    'water':('#7FD0F3','#4794D8'), 'blue':('#4794D8','#3471B8'),
    'wood':('#D58E50','#AF6734'), 'stone':('#E6E2DA','#C7C3BA'),
    'stone2':('#C7C3BA','#B7B7B7'), 'metal':('#727272','#565656'),
    'cream':('#FFF4C5','#F6E3A7'), 'cobble':('#F7E6AF','#EFD58E'),
    'red':('#F0463F','#C9332D'), 'pink':('#FF669D','#E04A80'),
    'purple':('#8E75DD','#6F57C2'), 'amber':('#FFAE2C','#E38E12'),
    'white':('#FFFFFF','#E9E6E0'), 'glass':('#FFF4C5','#F4D93B'),
}

def path(d):
    p=po.Path(); parse_path(d,p.getPen()); return p
def transform(p, sx=1, sy=1, dx=0, dy=0, angle=0):
    a=math.radians(angle); c=math.cos(a); s=math.sin(a)
    return p.transform(sx*c,sx*s,-sy*s,sy*c,dx,dy)
def op(a,b,kind): return po.op(a,b,kind)
def intersect(a,b): return op(a,b,po.PathOp.INTERSECTION)
def subtract(a,b): return op(a,b,po.PathOp.DIFFERENCE)
def union(a,b): return op(a,b,po.PathOp.UNION)
def poly(pts,close=True):
    p=po.Path(); p.moveTo(*pts[0])
    for xy in pts[1:]: p.lineTo(*xy)
    if close:p.close()
    return p
def smooth(pts,closed=True,tension=1):
    p=po.Path(); p.moveTo(*pts[0]); n=len(pts)
    for i in range(n if closed else n-1):
        a=pts[(i-1)%n] if closed or i else pts[0]
        b=pts[i]; c=pts[(i+1)%n]
        d=pts[(i+2)%n] if closed or i+2<n else c
        p.cubicTo(b[0]+(c[0]-a[0])*tension/6,b[1]+(c[1]-a[1])*tension/6,
                  c[0]-(d[0]-b[0])*tension/6,c[1]-(d[1]-b[1])*tension/6,*c)
    if closed:p.close()
    return p
def oval(x,y,w,h,wobble=0):
    if wobble:
        pts=[]
        for i in range(12):
            a=i*math.tau/12; f=1+wobble*math.sin(i*2.7+0.6)
            pts.append((x+math.cos(a)*w*.5*f,y+math.sin(a)*h*.5*f))
        return smooth(pts)
    k=.5522847498; rx=w/2; ry=h/2
    return path(f'M{x+rx} {y} C{x+rx} {y+ry*k} {x+rx*k} {y+ry} {x} {y+ry} C{x-rx*k} {y+ry} {x-rx} {y+ry*k} {x-rx} {y} C{x-rx} {y-ry*k} {x-rx*k} {y-ry} {x} {y-ry} C{x+rx*k} {y-ry} {x+rx} {y-ry*k} {x+rx} {y} Z')
def box(x,y,w,h,r=20,wobble=True):
    r=min(r,w/2,h/2)
    if not wobble:return path(f'M{x+r} {y} H{x+w-r} Q{x+w} {y} {x+w} {y+r} V{y+h-r} Q{x+w} {y+h} {x+w-r} {y+h} H{x+r} Q{x} {y+h} {x} {y+h-r} V{y+r} Q{x} {y} {x+r} {y} Z')
    return path(f'M{x+r} {y} C{x+w*.38} {y-3} {x+w*.66} {y+3} {x+w-r} {y} Q{x+w} {y} {x+w} {y+r} C{x+w+3} {y+h*.4} {x+w-2} {y+h*.7} {x+w} {y+h-r} Q{x+w} {y+h} {x+w-r} {y+h} C{x+w*.65} {y+h+2} {x+w*.35} {y+h-2} {x+r} {y+h} Q{x} {y+h} {x} {y+h-r} C{x-2} {y+h*.7} {x+2} {y+h*.4} {x} {y+r} Q{x} {y} {x+r} {y} Z')
def stroke(p,w=T):
    q=po.Path(p);q.stroke(w,po.LineCap.ROUND_CAP,po.LineJoin.ROUND_JOIN,4);q.convertConicsToQuads(.01)
    try:return po.simplify(q)
    except po.PathOpsError:return q
def svg_d(p):
    pen=SVGPathPen(None); p.draw(pen)
    # Float precision is far below the Drip pen width, but keeps files small.
    return re.sub(r'-?\d+\.\d+(?:e[-+]?\d+)?',lambda m:format(float(m[0]),'.3f').rstrip('0').rstrip('.'),pen.getCommands())

FONT=TTFont(str(ROOT/'rive/fonts/Gilroy-Black.ttf'))
GLYPHS=FONT.getGlyphSet(); CMAP=FONT.getBestCmap(); UPM=FONT['head'].unitsPerEm
def letters(text,x,y,size,centre=True):
    names=[CMAP.get(ord(c),'space') for c in text]
    widths=[FONT['hmtx'][n][0] for n in names]
    sc=size/UPM; xx=x-sum(widths)*sc/2 if centre else x
    out=po.Path()
    for n,w in zip(names,widths):
        p=po.Path();GLYPHS[n].draw(p.getPen()); out.addPath(transform(p,sc,-sc,xx,y));xx+=w*sc
    return out

class Art:
    def __init__(self):self.layers=[];self.lines_meta={}
    def put(self,p,col,name='detail'):
        if len(p):self.layers.append((name,po.Path(p),col))
        return p
    def line(self,p,col=INK,w=T,name='ink detail'):
        self.put(stroke(p,w),col,name);self.lines_meta[len(self.layers)-1]=(po.Path(p),w,col)
    def blob(self,p,pal='yellow',name='body',shade=.23,hi=.025,ink=True):
        base,dark=PAL[pal] if isinstance(pal,str) else pal
        self.put(p,base,name+' fill')
        x0,y0,x1,y1=p.bounds; w=x1-x0; h=y1-y0
        if shade:
            # A single dark shape on the right, including on concave objects.
            # Translating a concave silhouette can leave unrelated dark islands.
            cut=x1-w*shade
            side=intersect(p,path(f'M{cut-w*.08} {y0-h*.1} C{cut+w*.04} {y0+h*.22} {cut+w*.12} {y0+h*.56} {cut} {y1+h*.1} H{x1+w} V{y0-h*.1} Z'))
            self.put(side,dark,name+' right shade')
        if hi and w>12 and h>12:
            left=intersect(p,transform(p,dx=-w*.23))
            shine=subtract(left,transform(p,dx=max(4,w*hi),dy=max(4,min(h,w)*hi)))
            shine=intersect(shine,box(x0-1,y0-1,w*.58,h*.68,0,False))
            self.put(shine,'#FFFFFF',name+' white streak')
        if ink:self.line(p,name=name+' outline')
        return p
    def text(self,txt,x,y,size,col=INK):self.put(letters(txt,x,y,size),col,'lettering '+txt)
    def add(self,other,dx=0,dy=0,s=1,angle=0):
        # Ink remains 7.5 world units even on a smaller inset bread or motif.
        for i,(n,p,c) in enumerate(other.layers):
            centreline=other.lines_meta.get(i)
            if centreline and c==INK and centreline[1]==T:
                self.line(transform(centreline[0],s,s,dx,dy,angle),c,T,n)
            else:self.put(transform(p,s,s,dx,dy,angle),c,n)

ASSETS=[]
def save(a,category,name,notes='',tile=None,repeat_axes='xy'):
    assert a.layers,(category,name)
    b=[p.bounds for _,p,_ in a.layers]
    x0=min(v[0] for v in b);y0=min(v[1] for v in b);x1=max(v[2] for v in b);y1=max(v[3] for v in b)
    if tile:
        w,h=tile; ox=oy=0
        # Geometry already wraps and clips to this exact boundary.
    else:
        w=math.ceil(max(abs(x0),abs(x1))*2+24);h=math.ceil(y1-y0+24)
        ox=w/2;oy=h-12-y1
    pth=ROOT/'assets'/category/(name+'.svg');pth.parent.mkdir(parents=True,exist_ok=True)
    chunks=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',f'<title>{name.replace("-"," ")}</title>',f'<desc>Ducky Land. Drip ink 7.5 world units. Ground anchor {w/2:g},{h-12 if not tile else h:g}. Hand-built Bezier paths.</desc>']
    for i,(label,p,c) in enumerate(a.layers):
        ident=re.sub('[^a-zA-Z0-9_-]','-',label)
        chunks.append(f'<path id="{i:03d}-{ident}" d="{svg_d(transform(p,dx=ox,dy=oy))}" fill="{c}"/>')
    chunks.append('</svg>');pth.write_text('\n'.join(chunks)+'\n')
    ASSETS.append({'name':name,'category':category,'file':str(pth.relative_to(ROOT)),
        'size':{'width':w,'height':h,'ducky_units':{'width':round(w/713,4),'height':round(h/937,4)}},
        'anchor':{'type':'ground-bottom-centre','x':w/2,'y':h if tile else h-12,'normalized':[.5,1 if tile else round((h-12)/h,6)]},
        'outline_world_units':T,'path_count':len(a.layers),'seamless':bool(tile and repeat_axes),'repeat_axes':repeat_axes if tile else '', 'notes':notes})

def leaf(a,x,y,w=170,h=90,angle=0,pal='leaf'):
    p=path(f'M{-w/2} 0 C{-w*.2} {-h*.8} {w*.25} {-h*.6} {w/2} 0 C{w*.2} {h*.6} {-w*.25} {h*.6} {-w/2} 0 Z')
    a.blob(transform(p,dx=x,dy=y,angle=angle),pal,'leaf',hi=.024)

def bread(kind='loaf',s=1):
    a=Art()
    if kind in ('loaf','golden-bread','baguette'):
        w,h=(460,180) if kind=='baguette' else (280,210)
        p=smooth([(-w/2,-h*.2),(-w*.46,-h*.7),(-w*.22,-h),(w*.25,-h*.94),(w*.49,-h*.62),(w*.48,-h*.12),(w*.2,0),(-w*.24,0)])
        a.blob(p,'yellow' if kind=='golden-bread' else 'wood','bread',hi=.028)
        for x in (-.23,0,.23):
            a.line(path(f'M{x*w-10} {-h*.76} Q{x*w-32} {-h*.57} {x*w+8} {-h*.4}'),'#FFF4C5',12,'bread score')
    elif kind=='croissant':
        p=path('M-200 -20 C-285 -110 -186 -300 -16 -280 C173 -300 275 -120 201 -20 Q161 32 146 -38 L108 -119 Q0 -175 -105 -120 L-145 -35 Q-158 32 -200 -20 Z')
        a.blob(p,'amber','croissant',hi=.025)
        for x,ang in [(-125,-20),(-60,-9),(45,9),(120,20)]:
            a.line(path(f'M{x} -237 Q{x-36} -177 {x-8} -114'),INK,T,'pastry fold')
    elif kind in ('egg','golden-egg'):
        a.blob(smooth([(0,-292),(72,-240),(116,-125),(102,-36),(5,0),(-100,-31),(-112,-118),(-66,-244)]),'yellow' if kind=='golden-egg' else 'white','egg',hi=.028)
    elif kind=='bread-slice':
        p=path('M-112 -15 L-112 -130 C-180 -250 -66 -296 0 -265 C90 -300 171 -241 115 -137 L115 -15 Q0 10 -112 -15 Z')
        a.blob(p,'wood','crust');a.blob(transform(p,.79,.79,0,-28),'cream','crumb',hi=0,shade=.12)
    elif kind.startswith('ice-cream'):
        a.blob(poly([(-81,-180),(81,-180),(8,0),(-8,0)]),'wood','cone')
        for yy in (-150,-110,-70):a.line(path(f'M-42 {yy} l75 -30'),w=5)
        if kind=='ice-cream-swirl':
            a.blob(path('M-100 -180 Q-131 -231 -75 -256 Q-96 -301 -37 -319 Q-36 -373 8 -387 Q-14 -351 52 -321 Q104 -304 77 -257 Q137 -238 99 -180 Z'),'cream','soft serve')
            a.line(path('M-74 -255 Q-7 -236 70 -259'),w=T)
        else:
            a.blob(oval(0,-235,215,185,.018),'pink','scoop')
            a.blob(oval(0,-349,175,160,.015),'cream','top scoop')
    elif kind in ('apple','pear'):
        if kind=='apple':p=smooth([(0,-208),(71,-227),(130,-166),(113,-56),(44,0),(0,-9),(-59,0),(-117,-64),(-125,-162),(-67,-224)])
        else:p=smooth([(-15,-260),(44,-236),(57,-146),(119,-68),(82,-7),(-64,0),(-121,-57),(-66,-147),(-51,-228)])
        a.blob(p,'red' if kind=='apple' else 'grass',kind)
        a.line(path('M0 -213 Q-14 -256 13 -281'),'#AF6734',17,'stem');leaf(a,43,-259,88,48,-20)
    elif kind=='cherries':
        a.line(path('M-65 -121 Q-40 -230 40 -251 Q22 -175 73 -106'),'#3E9F2F',10,'joined stems')
        for x,y in [(-65,-64),(75,-55)]:a.blob(oval(x,y,130,130,.02),'red','cherry')
        leaf(a,71,-231,98,46,18)
    elif kind=='donut':
        ring=subtract(oval(0,-123,260,240,.02),oval(0,-123,76,70))
        a.blob(ring,'wood','dough')
        ice=subtract(smooth([(-115,-159),(-87,-220),(-15,-238),(78,-212),(122,-150),(93,-108),(47,-136),(2,-93),(-48,-126),(-99,-97)]),oval(0,-123,76,70))
        a.blob(ice,'pink','icing',hi=.015)
    elif kind=='pretzel':
        rope=path('M-70 -45 C-170 -72 -192 -192 -110 -228 C-34 -266 55 -99 105 -66 C167 -18 222 -123 162 -191 C103 -260 11 -133 -47 -58 Q-4 -5 70 -45')
        a.blob(stroke(rope,49),'wood','pretzel')
    elif kind=='cupcake':
        a.blob(poly([(-111,-130),(112,-130),(83,0),(-75,0)]),'purple','cup')
        for x in (-48,0,48):a.line(path(f'M{x} -104 L{x*.7} -20'),w=5)
        a.blob(path('M-113 -131 Q-141 -192 -72 -217 Q-83 -277 -10 -279 Q-33 -330 14 -347 Q-6 -304 53 -277 Q110 -261 79 -216 Q143 -196 114 -131 Z'),'pink','frosting')
        a.blob(oval(15,-316,47,47),'red','cherry',hi=.04)
    elif kind=='seed-bag':
        a.blob(smooth([(-74,-210),(0,-190),(76,-210),(64,-143),(105,-39),(45,0),(-57,-2),(-109,-46),(-66,-149)]),'cream','bag')
        a.line(path('M-67 -186 Q1 -170 70 -187'),w=T)
        for x,y in [(-30,-100),(24,-85),(0,-50)]:a.blob(oval(x,y,23,38),'amber','seed',hi=0)
    else: raise ValueError(kind)
    if s!=1:
        out=Art();out.add(a,s=s);return out
    return a

def build_food():
    for k in ['loaf','baguette','croissant','bread-slice','golden-bread','egg','golden-egg','ice-cream-double','ice-cream-swirl','apple','pear','cherries','donut','pretzel','cupcake','seed-bag']:
        save(bread(k),'food',k)

def trunk(a,h=1300,w=190,curve=0):
    a.blob(path(f'M{-w*.6} 0 Q{-w*.35+curve} {-h*.5} {-w*.5+curve} {-h} L{w*.5+curve} {-h} Q{w*.3+curve} {-h*.5} {w*.65} 0 Z'),'wood','trunk',hi=.035)
    a.line(path(f'M{-w*.16} {-h*.12} Q{w*.15+curve} {-h*.35} {curve} {-h*.53}'),w=T,name='bark')

def tree(kind):
    a=Art()
    if kind in ('oak','round','willow','banyan','baguette','croissant','blossom'):
        trunk(a,1400,220,30)
        a.line(path('M-12 -1210 Q-275 -1390 -350 -1580'),'#AF6734',70,'left branch')
        a.line(path('M60 -1150 Q287 -1340 376 -1600'),'#AF6734',65,'right branch')
        if kind=='willow':
            for i,(x,y,w,h) in enumerate([(-580,-1300,430,1040),(-290,-1670,530,1000),(30,-1730,610,1030),(410,-1390,490,1070)]):
                a.blob(oval(x,y,w,h,.025),'leaf','willow curtain')
                a.line(path(f'M{x-45} {y-220} Q{x+50} {y} {x-25} {y+320}'),'#3E9F2F',T,'hanging vein')
        elif kind=='banyan':
            for x in [-460,-300,390,540]:
                a.blob(box(x-15,-1570,30,1540,15),'wood','hanging root',hi=0)
            a.blob(smooth([(-850,-1430),(-900,-1720),(-660,-1920),(-330,-1860),(-120,-2180),(230,-2050),(490,-1870),(780,-1930),(940,-1650),(810,-1390),(410,-1360),(0,-1420),(-450,-1350)]),'leaf','banyan crown')
        else:
            pal='pink' if kind=='blossom' else 'leaf'
            lobes=[(-490,-1500,690,710),(420,-1510,760,690),(-240,-1860,770,750),(130,-1970,790,790),(0,-1480,800,670)]
            if kind=='round':lobes=[(0,-1680,1450,1480)]
            for x,y,w,h in lobes:a.blob(oval(x,y,w,h,.022),pal,'crown')
            if kind in ('baguette','croissant'):
                for x,y,ang in [(-510,-1460,-25),(-120,-1910,17),(460,-1540,25),(40,-1350,-12)]:
                    a.add(bread('baguette' if kind=='baguette' else 'croissant'),x,y,angle=ang)
            if kind=='blossom':
                for x,y in [(-450,-1730),(0,-2110),(430,-1640),(-70,-1460)]:flower(a,x,y,80,'white',stem=False)
    elif kind=='pine':
        trunk(a,1020,160)
        for yy,ww in [(-650,1250),(-1110,1050),(-1530,790)]:
            p=path(f'M{-ww/2} {yy} Q{-ww*.3} {yy-190} 0 {yy-830} Q{ww*.29} {yy-190} {ww/2} {yy} Q{ww*.3} {yy+78} {ww*.18} {yy+40} Q0 {yy+150} {-ww*.18} {yy+40} Q{-ww*.3} {yy+78} {-ww/2} {yy} Z')
            a.blob(p,'leaf','pine tier')
    elif kind in ('palm','coconut-palm'):
        trunk(a,2100,190,300)
        trunkpath=a.layers[0][1]
        for yy in range(-1900,-80,190):a.put(intersect(stroke(path(f'M-20 {yy} Q240 {yy+45} 470 {yy-8}'),T),trunkpath),'#AF6734','palm ring')
        for x,y,ang,w in [(-340,-2040,-160,1070),(-320,-2300,-135,1100),(150,-2450,-95,980),(700,-2290,-42,1100),(840,-1990,-15,1110),(520,-1790,30,870)]:
            leaf(a,x,y,w,280,ang)
        if kind=='coconut-palm':
            for x,y in [(180,-2070),(330,-2020),(420,-2120)]:a.blob(oval(x,y,160,190,.02),'wood','coconut')
    return a

def flower(a,x,y,r=90,pal='pink',stem=True):
    if stem:
        a.line(path(f'M{x} {y+r*2.7} Q{x+25} {y+r} {x} {y}'),'#3E9F2F',12,'flower stem')
        leaf(a,x+r*.45,y+r*1.7,r,r*.5,-30)
    p=None
    for i in range(5):
        ang=i*math.tau/5-math.pi/2
        q=oval(x+math.cos(ang)*r*.63,y+math.sin(ang)*r*.63,r*.88,r*.93)
        p=q if p is None else union(p,q)
    a.blob(p,pal,'petals',hi=.025);a.blob(oval(x,y,r*.65,r*.65),'yellow','flower centre',hi=0)

def build_nature():
    for k in ['oak','round','willow','banyan','baguette','croissant','blossom','pine','palm','coconut-palm']:save(tree(k),'nature','tree-'+k)
    for k in ['round','wide','berry','flowering']:
        a=Art()
        for x,y,w,h in ([(-170,-160,340,310),(150,-190,370,360),(0,-310,430,380)] if k!='wide' else [(-300,-160,400,330),(0,-220,530,450),(320,-160,440,330)]):a.blob(oval(x,y,w,h,.025),'leaf','bush lobe')
        if k=='berry':
            for x,y in [(-190,-210),(40,-390),(170,-180),(-20,-130)]:a.blob(oval(x,y,50,55),'red','berry')
        if k=='flowering':
            for x,y in [(-170,-200),(0,-410),(180,-270)]:flower(a,x,y,65,'pink',False)
        save(a,'nature','bush-'+k)
    for k,pal,r in [('daisy','white',65),('poppy','red',85),('pink','pink',80),('sunflower','amber',110)]:
        a=Art();flower(a,0,-r*2.7,r,pal);save(a,'nature','flower-'+k)
    a=Art()
    for x,y in [(-120,-280),(10,-370),(130,-250)]:flower(a,x,y,67,'pink')
    save(a,'nature','flower-cluster')
    a=Art();a.line(path('M0 0 Q30 -160 0 -300'),'#3E9F2F',16);leaf(a,-51,-120,120,60,-35)
    a.blob(path('M-110 -370 Q-87 -408 -43 -344 Q0 -419 36 -344 Q83 -413 111 -375 L89 -285 Q0 -210 -89 -285 Z'),'pink','tulip cup');save(a,'nature','flower-tulip')
    for i,(w,h) in enumerate([(350,210),(560,330),(220,330),(700,235)]):
        a=Art();a.blob(smooth([(-w/2,-h*.15),(-w*.4,-h*.72),(-w*.08,-h),(w*.3,-h*.85),(w*.5,-h*.28),(w*.32,0),(-w*.24,0)]),'stone2' if i==2 else 'stone','rock',hi=.025)
        if i==3:a.line(path('M-130 -129 Q-65 -205 -10 -191'),w=T)
        save(a,'nature','rock-'+['round','boulder','upright','flat'][i])
    for k,pts in [('three',[(-140,0),(-103,-170),(-28,-42),(20,-210),(65,-30),(139,-132),(143,0)]),('wide',[(-240,0),(-214,-102),(-100,-45),(-85,-184),(-10,-36),(67,-167),(105,-31),(214,-113),(240,0)]),('curl',[(-100,0),(-144,-147),(-50,-205),(14,-150),(-43,-128),(13,-30),(105,-188),(135,0)])]:
        a=Art()
        p=path('M-140 0 C-178 -75 -207 -165 -140 -203 C-95 -230 -40 -180 -74 -150 Q-99 -133 -112 -161 Q-135 -169 -138 -142 Q-146 -92 -70 -34 Q-55 -151 21 -206 Q21 -101 58 -51 Q110 -141 164 -153 Q124 -62 147 0 Z') if k=='curl' else smooth(pts,tension=.23)
        a.blob(p,'grass','grass blades',hi=.012);save(a,'nature','grass-tuft-'+k)
    for k,w,h,pal in [('red',260,240,'red'),('purple',210,290,'purple'),('cluster',160,170,'amber')]:
        a=Art()
        for xx,yy,f in ([(0,0,1)] if k!='cluster' else [(-100,0,1),(80,-10,.8),(20,-150,.7)]):
            a.blob(box(xx-w*.12,yy-h*.58,w*.24,h*.58,22),'cream','mushroom stem')
            a.blob(path(f'M{xx-w*.57*f} {yy-h*.5*f} C{xx-w*.59*f} {yy-h*1.1*f} {xx+w*.44*f} {yy-h*1.2*f} {xx+w*.57*f} {yy-h*.5*f} Q{xx} {yy-h*.30*f} {xx-w*.57*f} {yy-h*.5*f} Z'),pal,'mushroom cap')
            for dx,dy,rr in [(-.23,-.7,.065),(.05,-.86,.08),(.28,-.66,.055)]:a.put(oval(xx+dx*w*f,yy+dy*h*f,rr*w*2*f,rr*w*1.5*f),'#FFF4C5','cap spot')
        save(a,'nature','mushroom-'+k)
    for k in ['small','large','flower']:
        a=Art();w=370 if k=='small' else 610
        p=subtract(oval(0,-w*.23,w,w*.45,.018),poly([(0,-w*.23),(w*.6,-w*.48),(w*.6,-w*.13)]))
        a.blob(p,'leaf','lily pad',hi=.025)
        a.line(path(f'M{-w*.3} {-w*.2} Q{-w*.1} {-w*.29} 0 {-w*.23}'),w=T)
        if k=='flower':flower(a,-55,-170,80,'pink',False)
        save(a,'nature','lily-pad-'+k)
    for k in ['reeds','cattails']:
        a=Art()
        for x,h,lean in [(-120,520,-50),(0,680,30),(140,470,40)]:
            a.line(path(f'M{x} 0 Q{x+lean} {-h*.55} {x+lean} {-h}'),'#3E9F2F',13,'reed')
            if k=='cattails':a.blob(box(x+lean-24,-h-75,48,175,24),'wood','cattail',hi=.03)
            leaf(a,x-34,-h*.3,180,42,-65)
        save(a,'nature',k)
    a=Art();a.blob(box(-300,-220,600,215,100),'wood','fallen log');a.blob(oval(-245,-111,103,180),'cream','cut end');a.line(oval(-245,-111,55,105),'#AF6734',T,'growth ring');save(a,'nature','log')
    a=Art();a.blob(path('M-169 0 Q-100 -116 -129 -280 L130 -280 Q100 -104 172 0 Z'),'wood','stump');a.blob(oval(0,-276,278,97),'cream','stump top');a.line(oval(0,-276,150,49),'#AF6734',T);save(a,'nature','stump')

def ripple(a,x=0,y=-80,w=600,h=120,col='#FFFFFF'):
    a.line(path(f'M{x-w*.48} {y} C{x-w*.48} {y-h*.55} {x+w*.48} {y-h*.55} {x+w*.48} {y} C{x+w*.48} {y+h*.55} {x-w*.24} {y+h*.55} {x-w*.35} {y+h*.2}'),col,T,'water ripple')

def build_water():
    a=Art();p=smooth([(-980,-300),(-800,-600),(-360,-690),(10,-610),(540,-700),(1010,-370),(960,-80),(410,0),(-30,-80),(-590,0)])
    a.blob(p,'stone','pond bank');a.blob(transform(p,.89,.78,0,-60),'water','pond water',hi=.017)
    ripple(a,-340,-300,520,100);ripple(a,420,-240,440,80);save(a,'water','pond')
    for k,pts in [('straight',[(-700,-220),(700,-220),(700,-100),(380,-80),(10,-125),(-350,-82),(-700,-110)]),('cove',[(-700,-390),(-340,-350),(-200,-100),(230,-120),(400,-350),(700,-390),(700,0),(-700,0)]),('corner',[(-610,-650),(-300,-650),(-300,-310),(50,-175),(650,-175),(650,0),(-610,0)]),('island',[(-560,-230),(-300,-430),(200,-420),(570,-190),(290,0),(-260,-20)])]:
        a=Art();p=smooth(pts,tension=.55);a.blob(p,'grass','pond grass edge',hi=.012);save(a,'water','pond-edge-'+k,notes='Modular decorative shoreline. Use with the exact periodic terrain tiles for continuous boundaries.')
    for k,w,h in [('small',340,90),('long',950,120),('crest',590,230)]:
        a=Art()
        if k=='crest':p=path('M-280 0 C-185 -25 -169 -208 -35 -222 C81 -235 178 -116 95 -63 Q126 -154 38 -150 Q-10 -84 289 0 Z')
        else:p=path(f'M{-w/2} 0 Q{-w*.27} {-h} 0 {-h*.35} Q{w*.3} {-h*1.35} {w/2} 0 Q{w*.2} {h*.12} 0 0 Q{-w*.3} {h*.2} {-w/2} 0 Z')
        a.blob(p,'water','wave',hi=.02);save(a,'water','wave-'+k)
    for i,(w,h) in enumerate([(300,80),(640,145),(980,200)]):
        a=Art();ripple(a,0,-h*.5,w,h);ripple(a,0,-h*.5,w*.62,h*.62,'#4794D8');save(a,'water','ripple-'+['small','medium','wide'][i])
    a=Art();a.blob(oval(0,-130,1300,260),'stone','fountain basin');a.blob(oval(0,-190,1160,230),'water','basin water');a.blob(box(-180,-470,360,330,60),'stone','pedestal');save(a,'water','fountain-base')
    a=Art();a.blob(path('M-460 -210 Q-410 -30 0 0 Q410 -30 460 -210 Z'),'stone','fountain bowl');a.blob(oval(0,-214,935,210),'stone','bowl lip');a.blob(oval(0,-219,825,148),'water','bowl water');save(a,'water','fountain-bowl')
    a=Art();a.blob(path('M-150 0 Q-94 -150 -44 -510 C-121 -648 -243 -575 -225 -485 Q-317 -604 -204 -664 Q-85 -725 0 -590 Q85 -725 204 -664 Q317 -604 225 -485 C243 -575 121 -648 44 -510 Q94 -150 150 0 Z'),'water','water jet',hi=.025)
    for x,y in [(-190,-340),(210,-250),(-260,-130)]:a.blob(oval(x,y,48,69),'water','droplet')
    save(a,'water','fountain-jet')
    for k in ['bridge-arch','bridge-deck','bridge-rail']:
        a=Art()
        if k=='bridge-arch':
            p=path('M-900 0 L-900 -260 Q0 -930 900 -260 L900 0 L650 0 Q0 -520 -650 0 Z');a.blob(p,'stone','arched bridge')
            for xx,yy in [(-650,-250),(-350,-415),(0,-455),(350,-415),(650,-250)]:a.line(path(f'M{xx-30} {yy-120} L{xx+30} {yy}'),w=T)
        elif k=='bridge-deck':
            a.blob(box(-900,-210,1800,210,40),'wood','bridge deck')
            for xx in range(-750,900,180):a.line(path(f'M{xx} -185 V-25'),w=T)
        else:
            for xx in range(-800,801,400):a.blob(box(xx-26,-510,52,510,20),'wood','rail post')
            a.blob(box(-900,-495,1800,70,28),'wood','top rail');a.blob(box(-900,-250,1800,60,25),'wood','lower rail')
        save(a,'water',k)
    for k in ['rowboat','sailboat','paper-boat']:
        a=Art()
        if k=='paper-boat':
            a.blob(poly([(-390,-180),(0,-510),(390,-180),(250,0),(-250,0)]),'white','paper hull');a.line(path('M-390 -180 H390 M0 -510 V-180 L-250 0'),w=T)
        else:
            a.blob(path('M-550 -270 Q-400 0 0 0 Q410 0 550 -270 Q0 -160 -550 -270 Z'),'wood' if k=='rowboat' else 'red','boat hull')
            a.blob(oval(0,-267,1110,210),'wood','gunwale');a.blob(oval(0,-273,939,125),'cream','boat inside',hi=0)
            for xx in [-270,180]:a.blob(box(xx-45,-322,90,121,17),'wood','boat seat')
            if k=='sailboat':
                a.blob(box(-17,-1110,34,900,16),'wood','mast')
                a.blob(path('M-40 -1060 Q-390 -681 -405 -370 L-40 -370 Z'),'cream','sail left')
                a.blob(path('M33 -1057 L340 -380 L33 -380 Z'),'blue','sail right')
            else:
                a.blob(transform(box(-23,-620,46,960,20),angle=59,dx=0,dy=-80),'wood','oar shaft')
                a.blob(transform(oval(0,-520,105,270),angle=59,dx=0,dy=-80),'wood','oar blade')
        save(a,'water',k)
    for k in ['ring','duck']:
        a=Art();p=subtract(oval(0,-125,580,250,.015),oval(0,-140,300,95));a.blob(p,'pink' if k=='ring' else 'yellow','float ring')
        if k=='duck':
            a.blob(oval(175,-295,245,290,.02),'yellow','duck float head');a.blob(oval(299,-310,120,62),'orange','duck beak');a.put(oval(206,-348,18,27),INK,'eye')
        else:
            for xx in [-180,180]:a.blob(box(xx-35,-201,70,140,18),'cream','ring stripe',hi=0,shade=0)
        save(a,'water','float-'+k)
    for k,pal in [('red','red'),('channel','amber')]:
        a=Art();a.blob(oval(0,-35,340,70),'metal','buoy foot');a.blob(path('M-115 -45 L-77 -300 Q0 -360 77 -300 L115 -45 Z'),pal,'buoy');a.blob(box(-94,-170,188,70,15),'white','buoy stripe',hi=0);a.blob(oval(0,-351,50,58),'metal','eyelet');save(a,'water','buoy-'+k)
    a=Art()
    for xx in [-550,550]:a.blob(box(xx-55,-450,110,450,35),'wood','mooring post')
    a.blob(box(-720,-300,1440,210,25),'wood','dock deck')
    for xx in range(-540,700,180):a.line(path(f'M{xx} -280 V-110'),w=T)
    save(a,'water','dock-piece')

def window(a,x,y,w=230,h=250,pal='blue',arched=False):
    if arched:p=path(f'M{x-w/2} {y+h/2} V{y-h*.12} Q{x-w/2} {y-h*.65} {x} {y-h*.65} Q{x+w/2} {y-h*.65} {x+w/2} {y-h*.12} V{y+h/2} Z')
    else:p=box(x-w/2,y-h/2,w,h,35)
    a.blob(p,pal,'window glass',hi=.04)
    a.line(path(f'M{x-w*.39} {y} H{x+w*.39} M{x} {y-h*.4} V{y+h*.4}'),'#FFF4C5',14,'window mullion')
    a.blob(box(x-w*.58,y+h*.46,w*1.16,36,16),'wood','window sill',hi=0)

def door(a,x,y,w=270,h=460,pal='wood'):
    a.blob(path(f'M{x-w/2} {y} V{y-h*.67} C{x-w/2} {y-h*1.12} {x+w/2} {y-h*1.12} {x+w/2} {y-h*.67} V{y} Z'),pal,'door')
    a.blob(oval(x+w*.28,y-h*.44,25,25),'amber','door knob',hi=0)
    a.blob(box(x-w*.65,y-15,w*1.3,42,15),'stone','doorstep',hi=.02)

def awning(a,x,y,w=1700,h=360,pal='red'):
    roof=path(f'M{x-w/2} {y} L{x-w*.41} {y-h} Q{x} {y-h-26} {x+w*.41} {y-h} L{x+w/2} {y} Z')
    a.blob(roof,pal,'awning',hi=.012)
    for i in range(8):
        xx=x-w/2+i*w/8
        stripe=intersect(roof,poly([(xx,y+2),(xx+w/8,y+2),(x+(xx-x)*.82+w/8*.82,y-h-40),(x+(xx-x)*.82,y-h-40)]))
        if i%2:a.blob(stripe,'white','awning stripe',hi=0,ink=False)
        a.blob(path(f'M{xx} {y} H{xx+w/8} Q{xx+w/8} {y+95} {xx+w/16} {y+95} Q{xx} {y+95} {xx} {y} Z'),pal if i%2==0 else 'white','scallop',hi=.012)
    a.line(roof,name='awning roof ink')

def house(kind='cottage'):
    a=Art();pal={'cottage':'cream','townhouse':'pink','pond-house':'blue','bakery':'cream','library':'purple','cafe':'cream','kiosk':'grass'}.get(kind,'cream')
    w=1800 if kind in ['bakery','library','cafe'] else 1300
    h=1600 if kind=='townhouse' else 1150
    a.blob(box(-w*.39,-h-340,150,400,25),'stone','chimney')
    a.blob(box(-w/2,-h,w,h,65),pal,'house wall',hi=.018)
    if kind=='townhouse':
        a.blob(box(-w*.55,-h-120,w*1.1,150,45),'purple','flat cornice')
        for xx in [-300,300]:window(a,xx,-h+350,235,280)
    else:
        roof=path(f'M{-w*.59} {-h+20} Q{-w*.32} {-h-270} 0 {-h-550} Q{w*.28} {-h-320} {w*.59} {-h+20} Q0 {-h+90} {-w*.59} {-h+20} Z')
        a.blob(roof,'red' if kind not in ['library','pond-house'] else 'blue','roof')
        for xx in [-.3,-.1,.12,.32]:a.line(path(f'M{w*xx} {-h-180} q75 24 150 -3'),'#FFF4C5',T,'roof tile mark')
    if kind in ['cottage','townhouse','pond-house']:
        door(a,0,0,280,510)
        for xx in [-w*.3,w*.3]:window(a,xx,-700,250,290,arched=kind=='cottage')
        if kind=='pond-house':
            for xx in [-480,480]:a.blob(box(xx-45,-20,90,270,20),'wood','raised house stilt')
            a.blob(box(-610,-45,1220,75,25),'wood','porch')
    elif kind in ['bakery','cafe','library']:
        door(a,0,0,300,560,'wood')
        for xx in [-w*.31,w*.31]:window(a,xx,-440,540,570,arched=kind=='library')
        a.blob(box(-600,-1050,1200,220,50),'wood','shop sign')
        a.text({'bakery':'BREAD','cafe':'QUACK CAFE','library':'LIBRARY'}[kind],0,-893,140 if kind!='cafe' else 119,'#FFF4C5')
        if kind!='library':awning(a,0,-700,w*1.09,270,'red' if kind=='bakery' else 'leaf')
        else:
            for xx in [-600,600]:
                for i,col in enumerate(['red','amber','blue','grass']):a.blob(box(xx-160+i*85,-470,65,220+i*10,10),col,'book in window',hi=.015)
        if kind=='bakery':a.add(bread('croissant'),0,-1470,s=1.0)
        if kind=='cafe':
            a.blob(box(-127,-1500,240,150,35),'cream','roof cup');a.line(oval(150,-1430,90,95),'#FFF4C5',25,'cup handle')
    else:
        window(a,0,-630,850,510)
        a.blob(box(-720,-390,1440,110,35),'wood','kiosk counter')
        a.blob(box(-420,-1190,840,190,35),'yellow','kiosk sign');a.text('HELLO',0,-1055,125)
    return a

def market_stall(kind):
    a=Art();w=1700;pal={'bread':'amber','fruit':'red','flower':'pink','ice-cream':'blue'}[kind]
    for xx in [-660,660]:a.blob(box(xx-35,-1320,70,1320,22),'wood','stall post')
    a.blob(box(-760,-600,1520,600,55),'wood','stall counter')
    for xx in [-500,0,500]:a.line(path(f'M{xx} -510 V-60'),'#AF6734',T,'counter seam')
    a.blob(box(-840,-650,1680,100,28),'wood','counter top')
    for j,xx in enumerate([-500,0,500]):
        if kind=='bread':a.add(bread(['loaf','baguette','croissant'][j]),xx,-652,s=.85)
        elif kind=='fruit':
            for dx,dy in [(-90,0),(20,-60),(105,0)]:a.add(bread(['apple','pear','cherries'][j]),xx+dx,-660+dy,s=.55)
        elif kind=='flower':flower(a,xx,-940,100,['pink','white','amber'][j]);a.blob(box(xx-100,-805,200,160,28),'orange','flower pot')
        else:a.add(bread('ice-cream-double'),xx,-655,s=.8)
    awning(a,0,-1200,w,300,pal)
    a.blob(box(-360,-390,720,190,40),'cream','stall board');a.text({'bread':'BREAD','fruit':'FRUIT','flower':'BLOOMS','ice-cream':'SCOOPS'}[kind],0,-250,116)
    return a

def build_buildings():
    for k in ['cottage','townhouse','pond-house','bakery','library','cafe','kiosk']:save(house(k),'buildings',k)
    for k in ['bread','fruit','flower','ice-cream']:save(market_stall(k),'buildings','stall-'+k)
    a=Art()
    for xx in [-650,-250,250,650]:a.blob(box(xx-40,-1330,80,1330,25),'wood','gazebo column')
    a.blob(box(-860,-120,1720,120,40),'stone','gazebo base')
    for xx in [-500,500]:a.blob(box(xx-230,-650,460,70,20),'wood','gazebo rail')
    a.blob(path('M-1000 -1260 Q-510 -1520 0 -1900 Q490 -1510 1000 -1260 Q0 -1090 -1000 -1260 Z'),'blue','gazebo roof')
    a.blob(oval(0,-1900,100,90),'amber','finial');save(a,'buildings','gazebo')
    # Rubber-duck lighthouse, a single recognisable body silhouette with beak,
    # tuft, wing, orange plinth and a cream lantern room.
    a=Art();a.blob(box(-670,-160,1340,160,60),'orange','lighthouse foot')
    duck=path('M-570 -140 Q-650 -510 -445 -840 C-700 -940 -530 -1150 -405 -1290 Q-467 -1780 -105 -1900 Q-50 -2040 27 -1960 Q225 -2050 194 -1910 Q482 -1770 422 -1450 L590 -1350 Q727 -1280 590 -1218 L416 -1170 Q437 -995 573 -795 Q770 -465 563 -140 Z')
    a.blob(duck,'yellow','rubber duck lighthouse',hi=.024)
    a.blob(oval(560,-1286,420,158),'orange','lighthouse beak')
    a.blob(oval(213,-1430,75,98),'metal','porthole eye')
    a.blob(path('M-388 -851 Q-470 -495 -129 -423 Q101 -500 -15 -698 Q-103 -780 -388 -851 Z'),'yellow','duck wing')
    door(a,100,-160,240,450,'wood')
    for yy in [-955,-660]:window(a,150,yy,170,160,'blue',True)
    a.blob(box(-335,-2220,670,300,40),'glass','lantern room')
    for xx in [-210,0,210]:a.blob(box(xx-12,-2220,24,300,8),'metal','lantern mullion',hi=0)
    a.blob(oval(0,-1940,850,125),'metal','lantern balcony')
    a.blob(path('M-430 -2220 Q-235 -2430 0 -2460 Q242 -2400 430 -2220 Z'),'red','lantern cap');a.blob(oval(0,-2470,70,85),'amber','roof finial');save(a,'buildings','lighthouse-duck')

def bench(kind='wood'):
    a=Art();w=713
    for xx in [-270,270]:a.blob(box(xx-25,-410,50,410,17),'metal','bench leg')
    if kind=='wood':
        for yy in [-430,-310]:a.blob(box(-w/2,yy,w,92,28),'wood','back slat')
    else:a.blob(box(-w/2,-460,w,250,75),'leaf','park back')
    a.blob(box(-w*.54,-190,w*1.08,85,30),'wood','bench seat')
    for xx in [-330,330]:a.blob(box(xx-17,-290,34,165,15),'metal','arm support');a.blob(box(xx-62,-300,124,42,19),'wood','arm rest')
    return a

def lamp(kind='lantern'):
    a=Art();h=1700
    a.blob(box(-31,-h+250,62,h-280,22),'metal','lamp post')
    a.blob(oval(0,-38,230,76),'metal','lamp base')
    if kind=='lantern':
        a.blob(poly([(-140,-h+85),(140,-h+85),(107,-h+400),(-107,-h+400)]),'glass','lantern glass')
        for xx in [-117,117]:a.line(path(f'M{xx} {-h+105} L{xx*.8} {-h+381}'),'#565656',14,'lantern frame')
        a.blob(path(f'M-200 {-h+80} Q-80 {-h-70} 0 {-h-105} Q100 {-h-30} 200 {-h+80} Z'),'metal','lantern cap')
        a.blob(box(-128,-h+390,256,42,20),'metal','lantern foot')
    else:
        a.line(path(f'M0 {-h+320} Q-30 {-h-120} 300 {-h+40}'),'#565656',40,'gooseneck')
        a.blob(path(f'M125 {-h+110} Q230 {-h-50} 375 {-h+110} Z'),'metal','street lamp hood')
        a.blob(oval(250,-h+110,250,75),'glass','lamp face')
    return a

def city_motif(city):
    a=Art()
    if city=='kochi':
        a.line(path('M-130 0 L-15 -240 L120 -30 M-15 -240 L-180 -115 L120 -30 M-180 -115 L-130 0 L120 -30'),'#FFF4C5',13,'fishing net frame')
        for i in range(1,5):a.line(path(f'M{-180+i*49} {-115+i*14} L{-130+i*42} {-i*5}'),'#FFF4C5',5,'net mesh')
    elif city=='chennai':
        for i in range(4):a.blob(box(-160+i*25,-i*58-55,320-i*50,60,9),'cream','temple tier',hi=0,shade=0)
        a.blob(box(-32,-92,64,92,20),'wood','temple door',hi=0)
    elif city=='bengaluru':
        a.line(path('M0 0 V-200'),'#FFF4C5',15)
        for x,y,ang in [(-65,-90,-150),(65,-145,-25),(-50,-190,-140)]:leaf(a,x,y,150,72,ang,'cream')
    elif city=='london':
        a.blob(box(-66,-252,132,252,15),'cream','clock tower',hi=0)
        a.blob(poly([(-90,-250),(0,-330),(90,-250)]),'amber','tower crown',hi=0)
        a.blob(oval(0,-187,88,88),'white','clock face',hi=0)
        a.line(path('M0 -214 V-187 L25 -170'),w=T)
    elif city=='mumbai':
        a.blob(subtract(box(-171,-200,342,200,12),path('M-60 10 V-85 Q-60 -160 0 -160 Q60 -160 60 -85 V10 Z')),'cream','gateway',hi=0)
        for xx in [-140,140]:a.blob(box(xx-27,-260,54,65,10),'cream','gateway turret',hi=0)
    elif city=='delhi':
        a.blob(subtract(poly([(-140,0),(-105,-260),(105,-260),(140,0)]),path('M-53 10 V-90 Q0 -175 53 -90 V10 Z')),'cream','India gate',hi=0)
        a.blob(box(-140,-280,280,42,10),'cream','gate lintel',hi=0)
    elif city=='hyderabad':
        for xx in [-140,140]:
            a.blob(box(xx-23,-265,46,265,12),'cream','minaret',hi=0)
            a.blob(oval(xx,-272,70,40),'cream','minaret dome',hi=0)
        a.blob(subtract(box(-120,-180,240,180,20),path('M-50 8 V-78 Q0 -163 50 -78 V8 Z')),'cream','Charminar arch',hi=0)
    elif city=='pune':
        a.blob(box(-160,-170,320,170,10),'cream','fort wall',hi=0)
        for xx in [-160,-80,0,80,160]:a.blob(box(xx-25,-220,50,70,8),'cream','fort battlement',hi=0)
        a.blob(path('M-48 0 V-76 Q0 -150 48 -76 V0 Z'),'wood','fort gate',hi=0)
    return a

def build_street():
    for k in ['wood','park']:save(bench(k),'street','bench-'+k)
    for k in ['lantern','gooseneck']:save(lamp(k),'street','lamp-'+k)
    for k,pal,label in [('bakery','amber','BREAD'),('park','leaf','POND'),('welcome','blue','DUCKY LAND')]:
        a=Art();a.blob(box(-32,-1100,64,1100,20),'wood','sign post')
        a.blob(path('M-400 -1120 L300 -1120 L410 -980 L300 -840 L-400 -840 Q-440 -980 -400 -1120 Z'),pal,'direction board')
        a.text(label,-10,-934,105 if k!='welcome' else 83,'#FFF4C5');save(a,'street','sign-'+k)
    a=Art();a.blob(box(-35,-1300,70,1300,20),'wood','direction post')
    for xx,yy,txt,pal in [(70,-1250,'POND','blue'),(-65,-920,'BREAD','amber'),(55,-590,'HOME','pink')]:
        a.blob(box(xx-330,yy,660,210,45),pal,'direction board');a.text(txt,xx,yy+145,112,'#FFF4C5')
    save(a,'street','signpost-three-way')
    for k in ['picket','rail','gate']:
        a=Art()
        for yy in [-490,-190]:a.blob(box(-600,yy,1200,65,20),'wood','fence rail')
        if k=='picket':
            for xx in range(-520,521,173):a.blob(path(f'M{xx-47} 0 V-580 Q{xx} -680 {xx+47} -580 V0 Z'),'cream','picket')
        elif k=='rail':
            for xx in [-570,570]:a.blob(box(xx-42,-650,84,650,30),'wood','fence post')
        else:
            for xx in [-570,570]:a.blob(box(xx-45,-670,90,670,30),'wood','gate post')
            for xx in [-350,-100,150,390]:a.blob(box(xx-25,-515,50,515,15),'wood','gate spindle')
            a.line(path('M-480 -40 L480 -470'),'#AF6734',28,'gate brace');a.blob(oval(430,-320,35,35),'amber','latch')
        save(a,'street','fence-'+k,notes='Straight fence pieces meet on their visible end posts.')
    for k,pal in [('litter','leaf'),('recycling','blue')]:
        a=Art();a.blob(path('M-160 -30 L-187 -540 Q0 -585 187 -540 L160 -30 Q0 0 -160 -30 Z'),pal,'bin body')
        a.blob(oval(0,-550,405,100),'metal','bin lid');a.blob(box(-85,-565,170,42,20),'metal','bin opening',hi=0)
        if k=='recycling':
            for ang in [0,120,240]:
                pp=path('M-55 -57 L35 -57 L35 -90 L95 -25 L35 22 L35 -13 L-55 -13 Z');a.put(transform(pp,dx=0,dy=-275,angle=ang),'#FFF4C5','recycle arrow')
        else:a.blob(box(-95,-390,190,140,30),'cream','litter panel',hi=0);a.line(path('M-38 -368 V-277 M0 -368 V-277 M38 -368 V-277'),w=T)
        save(a,'street','bin-'+k)
    a=Art();a.blob(box(-33,-940,66,940,20),'wood','mail post');a.blob(path('M-230 -680 V-1010 C-230 -1260 230 -1260 230 -1010 V-680 Z'),'red','mailbox')
    a.blob(box(-147,-1050,294,62,25),'metal','mail slot');a.text('POST',0,-805,95,'#FFF4C5');a.blob(box(205,-1080,40,270,12),'metal','flag pole');a.blob(box(200,-1080,165,90,15),'yellow','mail flag');save(a,'street','mailbox')
    a=Art();a.line(path('M-1200 -260 Q0 180 1200 -260'),w=T,name='bunting string')
    for i in range(9):
        x=-1040+i*260;y=-260+(1-(x/1200)**2)*220
        a.blob(smooth([(x-95,y),(x+95,y),(x+5,y+210)],tension=.28),['red','amber','blue','purple','pink','leaf'][i%6],'pennant',hi=.02)
    save(a,'street','bunting')
    for city,pal in [('kochi','leaf'),('chennai','amber'),('bengaluru','purple'),('london','blue'),('mumbai','pink'),('delhi','red'),('hyderabad','orange'),('pune','leaf')]:
        a=Art();a.blob(box(-350,-1550,44,1550,18),'metal','flagpole');a.blob(oval(-328,-1568,75,75),'amber','pole finial')
        p=path('M-300 -1510 C-85 -1605 100 -1380 370 -1510 L370 -920 C80 -795 -75 -1035 -300 -915 Z');a.blob(p,pal,'city flock flag',hi=.018)
        a.add(city_motif(city),30,-1100,s=.95);a.text(city.upper(),25,-944,74 if len(city)<9 else 64,'#FFF4C5')
        save(a,'street','flag-'+city,notes='Ducky Land city flock pennant with a landmark motif. Original game art, not an official municipal flag.')
    for k,pal in [('garden','pink'),('cafe','leaf')]:
        a=Art();a.blob(box(-23,-1570,46,1570,18),'wood','umbrella pole');a.blob(oval(0,-35,290,70),'stone','umbrella stand')
        canopy=path('M-780 -1180 Q-550 -1600 0 -1660 Q540 -1600 780 -1180 Q590 -1290 390 -1150 Q190 -1280 0 -1150 Q-190 -1280 -390 -1150 Q-590 -1290 -780 -1180 Z');a.blob(canopy,pal,'umbrella canopy')
        for xx in [-390,0,390]:a.line(path(f'M0 -1640 Q{xx*.7} -1440 {xx} -1165'),'#FFF4C5',T,'umbrella rib')
        save(a,'street','umbrella-'+k)
    a=Art()
    for sign in [-1,1]:
        a.blob(poly([(sign*205,-545),(sign*280,-545),(sign*470,0),(sign*385,0)]),'wood','table trestle')
        a.blob(box(sign*650-26,-270,52,270,20),'wood','bench leg')
    a.blob(box(-720,-260,1440,60,20),'wood','seat cross brace')
    a.blob(box(-550,-620,1100,130,40),'wood','picnic top')
    for xx in [-650,650]:a.blob(box(xx-140,-310,280,75,25),'wood','picnic bench')
    a.line(path('M-480 -555 H480'),'#AF6734',T,'table seam');save(a,'street','picnic-table')
    a=Art();a.line(path('M-180 -210 C-230 -620 230 -620 180 -210'),'#AF6734',38,'basket handle');a.blob(box(-280,-300,560,300,60),'wood','picnic basket')
    for xx in [-160,-50,60,170]:a.line(path(f'M{xx} -255 V-30'),'#AF6734',T,'basket weave')
    a.blob(box(-300,-325,600,80,30),'wood','basket lid');save(a,'street','picnic-basket')
    a=Art();a.blob(box(-590,-400,1180,380,50),'cream','picnic blanket')
    for xx in [-400,-100,200,500]:a.put(intersect(box(xx,-399,80,380,0),box(-585,-395,1170,370,45)),'#F4764E','blanket stripe')
    a.add(bread('loaf'),-160,-90,s=.75);a.add(bread('apple'),170,-80,s=.6);save(a,'street','picnic-blanket')
    for k,pal in [('flowers','orange'),('leaf','purple')]:
        a=Art();a.blob(poly([(-220,-260),(220,-260),(170,0),(-170,0)]),pal,'planter pot');a.blob(box(-250,-300,500,80,30),pal,'planter lip')
        if k=='flowers':
            for x,y,pp in [(-130,-560,'pink'),(30,-670,'white'),(160,-500,'amber')]:flower(a,x,y,85,pp)
        else:
            for x,y,ang in [(-130,-500,-140),(0,-650,-90),(130,-480,-35),(10,-430,15)]:leaf(a,x,y,370,170,ang)
        save(a,'street','planter-'+k)
    a=Art();a.blob(box(-72,-620,144,590,65),'metal','bollard');a.blob(box(-68,-492,136,90,25),'yellow','bollard band');a.blob(oval(0,-35,225,70),'metal','bollard base');save(a,'street','bollard')
    a=Art();a.blob(box(-90,-490,180,440,45),'red','hydrant body');a.blob(oval(0,-500,240,100),'red','hydrant cap')
    for xx in [-150,150]:a.blob(box(xx-60,-320,120,125,35),'red','hydrant side');a.blob(oval(xx,-258,60,77),'metal','hydrant port')
    a.blob(oval(0,-40,290,80),'metal','hydrant foot');save(a,'street','hydrant')
    a=Art()
    for xx in [-290,290]:a.line(path(f'M{xx-130} 0 V-280 C{xx-130} -500 {xx+130} -500 {xx+130} -280 V0'),'#565656',38,'cycle hoop')
    a.blob(box(-600,-40,1200,80,25),'metal','cycle rack base');save(a,'street','cycle-rack')

def shell(a,kind='scallop'):
    if kind=='scallop':
        p=path('M-70 0 Q-90 -40 -145 -75 Q-220 -133 -160 -169 Q-180 -235 -108 -231 Q-94 -300 -34 -265 Q12 -333 55 -265 Q120 -294 140 -228 Q210 -222 170 -155 Q223 -125 140 -64 Q99 -28 70 0 Z');a.blob(p,'pink','scallop shell')
        for x,y in [(-145,-164),(-95,-222),(-28,-250),(48,-249),(127,-218),(158,-150)]:a.line(path(f'M0 -20 Q{x*.6} -90 {x} {y}'),'#E04A80',T,'shell rib')
    elif kind=='conch':
        a.blob(smooth([(-240,-25),(-145,-118),(-145,-202),(-45,-218),(35,-298),(123,-229),(220,-100),(150,-8),(10,-40),(-140,0)]),'cream','conch shell')
        a.line(path('M120 -93 C200 -182 23 -223 10 -122 C-4 -45 102 -27 111 -93 C113 -138 59 -150 47 -111'),'#AF6734',T,'shell spiral')
    else:
        a.blob(oval(0,-103,320,210,.02),'cream','cowrie shell');a.line(path('M-110 -100 Q0 -60 110 -102'),'#AF6734',18,'shell aperture')
        for x in range(-80,81,32):a.line(path(f'M{x-5} -130 L{x+4} -76'),'#AF6734',T,'cowrie tooth')

def star_path(r=140,inner=.52):
    pts=[]
    for i in range(10):
        ang=i*math.pi/5-math.pi/2;rr=r if i%2==0 else r*inner
        pts.append((math.cos(ang)*rr,math.sin(ang)*rr))
    return smooth(pts,tension=.42)

def build_beach():
    for k,pts in [('bank',[(-800,0),(-780,-180),(-460,-270),(-70,-219),(330,-290),(780,-190),(800,0)]),('cove',[(-750,0),(-750,-440),(-400,-355),(-240,-140),(110,-170),(480,-450),(750,-400),(750,0)]),('island',[(-700,-120),(-440,-380),(0,-460),(450,-350),(700,-140),(300,0),(-260,-30)])]:
        a=Art();a.blob(smooth(pts,tension=.5),'cream','sand edge',hi=.012)
        for xx,yy in [(-400,-110),(0,-180),(410,-100)]:a.put(oval(xx,yy,18,12),'#D58E50','sand grain')
        save(a,'beach','sand-edge-'+k)
    for k in ['scallop','conch','cowrie']:
        a=Art();shell(a,k);save(a,'beach','shell-'+k)
    for k,pal in [('orange','orange'),('pink','pink')]:
        a=Art();p=transform(star_path(180,.56),dy=-150,angle=17 if k=='pink' else -10);a.blob(p,pal,'starfish')
        for x,y in [(0,-150),(-12,-235),(65,-165),(-65,-140),(42,-95)]:a.put(oval(x,y,11,12),'#FFF4C5','starfish dot')
        save(a,'beach','starfish-'+k)
    for k in ['small','turrets']:
        a=Art();a.blob(box(-370,-440,740,440,35),'cream','sandcastle wall')
        for xx in [-330,-165,0,165,330]:a.blob(box(xx-55,-520,110,130,15),'cream','battlement')
        a.blob(path('M-95 0 V-160 Q0 -310 95 -160 V0 Z'),'wood','castle arch')
        if k=='turrets':
            for xx in [-410,410]:
                a.blob(box(xx-100,-670,200,670,45),'cream','sand turret');a.blob(poly([(xx-150,-650),(xx,-950),(xx+150,-650)]),'cream','turret roof')
                a.blob(box(xx-6,-1080,12,160,5),'wood','castle flagpole',hi=0)
                a.blob(poly([(xx,-1080),(xx+130,-1029),(xx,-985)]),'red','castle flag',hi=.02)
        save(a,'beach','sandcastle-'+k)
    for k,pal in [('striped','blue'),('sun','pink')]:
        a=Art();t=box(-310,-830,620,830,45);a.blob(t,pal,'beach towel')
        if k=='striped':
            for yy in [-750,-540,-330,-120]:a.put(intersect(box(-310,yy,620,75,0),t),'#FFF4C5','towel stripe')
        else:a.blob(oval(0,-415,270,270),'yellow','towel sun',hi=.02)
        for xx in range(-250,251,100):a.line(path(f'M{xx} -10 V30'),'#FFF4C5',T,'towel fringe')
        save(a,'beach','towel-'+k)
    a=Art();ball=oval(0,-180,360,360,.012);a.blob(ball,'yellow','beach ball')
    for dx,pal in [(-110,'blue'),(110,'red')]:a.blob(intersect(ball,oval(dx,-180,160,365)),pal,'ball panel',hi=0,ink=False)
    a.blob(oval(0,-325,58,35),'white','ball valve');a.line(ball);save(a,'beach','beach-ball')
    a=Art();a.line(path('M-150 -280 C-270 -660 270 -660 150 -280'),'#565656',20,'bucket handle');a.blob(poly([(-220,-330),(220,-330),(160,0),(-160,0)]),'blue','sand bucket');a.blob(oval(0,-330,460,95),'blue','bucket rim');a.blob(oval(0,-333,390,54),'cream','bucket sand',hi=0);save(a,'beach','bucket')
    a=Art();a.blob(box(-24,-650,48,490,20),'wood','spade handle');a.line(box(-85,-750,170,115,50),'#D9573A',35,'spade grip');a.blob(path('M-120 -200 H120 L90 -42 Q0 45 -90 -42 Z'),'orange','spade blade');save(a,'beach','spade')

def wrapped(a,p,col,w=713,h=713):
    bound=box(0,0,w,h,0,False)
    for dx in [-w,0,w]:
        for dy in [-h,0,h]:
            q=intersect(transform(p,dx=dx,dy=dy),bound)
            if len(q):a.put(q,col,'periodic detail')

def wrapped_art(a,b,w=713,h=713):
    for n,p,col in b.layers:wrapped(a,p,col,w,h)

def build_tiles():
    n=713
    for k,pal in [('grass','grass'),('sand','cream'),('water','water'),('cobble','cobble'),('cobble-large','stone'),('path-dirt','wood'),('path-brick','red'),('path-stepping','cream')]:
        a=Art();a.put(box(0,0,n,n,0,False),PAL[pal][0],'tile foundation')
        if k.startswith('cobble'):
            step=178.25 if k=='cobble' else 356.5
            for row in range(5 if k=='cobble' else 3):
                for col in range(5 if k=='cobble' else 3):
                    x=col*step+(step/2 if row%2 else 0);y=row*step
                    b=Art();b.blob(oval(x,y,step*.9,step*.72,.025),pal,'cobble',hi=.02);wrapped_art(a,b)
        elif k=='path-brick':
            for row in range(5):
                for col in range(4):
                    b=Art();b.blob(box(col*n/3+(n/6 if row%2 else 0),row*n/4,n/3-14,n/4-14,18),'wood','brick',hi=.015);wrapped_art(a,b)
        elif k=='path-stepping':
            for x,y,w,h in [(80,75,250,180),(440,290,300,210),(90,570,270,220)]:
                b=Art();b.blob(oval(x,y,w,h,.028),'stone','stepping stone');wrapped_art(a,b)
        elif k=='water':
            for x,y in [(80,90),(460,320),(150,620)]:
                wrapped(a,stroke(path(f'M{x-95} {y} Q{x-40} {y-28} {x} {y} Q{x+50} {y+25} {x+105} {y-3}'),T),'#FFFFFF')
        elif k=='grass':
            for x,y in [(40,80),(430,310),(165,560)]:wrapped(a,stroke(path(f'M{x-20} {y} l-14 -45 M{x} {y-4} v-61 M{x+18} {y} l25 -36'),T),'#3E9F2F')
        elif k=='sand':
            for x,y in [(24,50),(230,120),(600,72),(382,388),(80,560),(649,623)]:wrapped(a,oval(x,y,13,9),'#D58E50')
        else:
            for x,y in [(50,90),(290,300),(610,550)]:wrapped(a,stroke(path(f'M{x-40} {y} q35 -16 78 0'),T),'#AF6734')
        save(a,'tiles',k,tile=(n,n),notes='Exact 713-unit periodic tile. Repeats in both axes. No padding or outside stroke.')
    # Oriented border tiles. The opposing edges in the repeat direction match.
    for material,base,accent in [('grass','cream','grass'),('sand','water','cream'),('water','grass','water')]:
        for orientation in ['north','south','east','west']:
            a=Art();a.put(box(0,0,n,n,0,False),PAL[base][0],'tile background')
            mid=n/2
            wave=f'M0 {mid} C{n*.16} {mid} {n*.33} {mid+58} {n*.5} {mid} C{n*.67} {mid-58} {n*.84} {mid} {n} {mid}'
            edge=path(wave+f' V{n} H0 Z')
            b=Art();b.put(edge,PAL[accent][0],'terrain side')
            band=subtract(transform(edge,dy=18),transform(edge,dy=52))
            b.put(intersect(edge,band),PAL[accent][1],'edge side shade')
            boundary=path(wave)
            b.put(intersect(stroke(boundary,T),box(0,0,n,n,0,False)),INK,'terrain edge ink')
            for name,p,c in b.layers:
                if orientation=='north':q=p
                elif orientation=='south':q=transform(p,-1,-1,n,n)
                elif orientation=='east':q=transform(p,dx=n,angle=90)
                else:q=transform(p,dy=n,angle=-90)
                a.put(q,c,name)
            save(a,'tiles',material+'-edge-'+orientation,tile=(n,n),repeat_axes='x' if orientation in ['north','south'] else 'y',notes='Terrain transition. Repeat only along the straight edge. Combine orientations at region borders.')
    for corner,angle,dx,dy in [('nw',0,0,0),('ne',90,n,0),('se',180,n,n),('sw',270,0,n)]:
        a=Art();a.put(box(0,0,n,n,0,False),PAL['grass'][0],'grass foundation')
        mid=n/2;k=.5522847498
        curve=path(f'M{n} {mid} C{n-mid*k} {mid} {mid} {n-mid*k} {mid} {n}')
        p=path(f'M{n} {mid} C{n-mid*k} {mid} {mid} {n-mid*k} {mid} {n} H{n} Z')
        b=Art();b.put(p,PAL['water'][0],'corner water')
        # One flat band follows the shoreline, with no stroke around tile bounds.
        band=intersect(subtract(stroke(curve,104),stroke(curve,36)),p);b.put(band,PAL['water'][1],'corner water shade')
        b.put(stroke(curve,T),INK,'corner shoreline ink')
        for name,p,c in b.layers:a.put(intersect(transform(p,dx=dx,dy=dy,angle=angle),box(0,0,n,n,0,False)),c,name)
        save(a,'tiles','water-corner-'+corner,tile=(n,n),repeat_axes='',notes='Nonrepeating corner connector. Match with water-edge sides. Exact tile extents.')

def heart_path():return path('M0 0 C-300 -175 -190 -360 -65 -300 Q-15 -278 0 -231 Q15 -278 65 -300 C190 -360 300 -175 0 0 Z')

def bubble(a,kind='speech',w=650,h=340):
    if kind=='thought':
        a.blob(oval(0,-h*.7,w,h,.025),'white','thought cloud');a.blob(oval(-w*.3,-h*.04,75,75),'white','thought bead');a.blob(oval(-w*.4,h*.16,38,38),'white','thought bead')
    elif kind=='round':a.blob(path(f'M{-w*.42} {-h} Q{w*.48} {-h*1.3} {w*.5} {-h*.5} Q{w*.53} {-h*.05} {-w*.2} {-h*.12} L{-w*.46} 0 L{-w*.36} {-h*.22} Q{-w*.63} {-h*.6} {-w*.42} {-h} Z'),'white','speech bubble')
    else:
        p=box(-w/2,-h,w,h*.82,80)
        p=union(p,poly([(-w*.3,-h*.25),(-w*.41,0),(-w*.05,-h*.23)]));a.blob(p,'white','speech bubble')

def build_fx_icons():
    for k,pts in [('small',[(-130,-30),(-172,-100),(-120,-165),(-58,-156),(-8,-231),(85,-188),(116,-134),(174,-98),(130,-30),(20,0)]),('wide',[(-350,-40),(-370,-122),(-290,-190),(-201,-166),(-124,-277),(0,-249),(73,-188),(179,-240),(274,-166),(360,-144),(340,-42),(170,0),(-160,-7)]),('trail',[(-340,-8),(-400,-50),(-330,-110),(-240,-100),(-150,-175),(-60,-132),(20,-210),(132,-171),(190,-90),(260,-60),(210,0)])]:
        a=Art();a.blob(smooth(pts),'white','puff',hi=.015);save(a,'fx','puff-'+k)
    for k in ['small','wide','crown']:
        a=Art();pts=[(-250,0),(-260,-80),(-165,-60),(-180,-220),(-60,-115),(0,-300),(60,-115),(180,-220),(165,-60),(260,-80),(250,0)]
        p=smooth(pts,tension=.3)
        if k=='small':p=transform(p,.6,.6)
        if k=='wide':p=transform(p,1.6,.7)
        a.blob(p,'water','splash',hi=.025)
        for x,y in [(-175,-320),(180,-270)]:a.blob(oval(x,y,45,63),'water','splash droplet')
        save(a,'fx','splash-'+k)
    for k,r,pal in [('rounded',145,'yellow'),('small',85,'amber')]:
        a=Art();a.blob(transform(star_path(r),dy=-r),'yellow' if k=='rounded' else pal,'five point star');save(a,'fx','star-'+k,notes='Chunky five-point star. No sparkle rays, glow or glitter.')
    for k,pal,f in [('red','red',1),('pink','pink',1),('small','red',.55)]:
        a=Art();a.blob(transform(heart_path(),f,f),'red' if k!='pink' else pal,'heart');save(a,'fx','heart-'+k)
    a=Art();a.text('Z',-150,-130,150,'#727272');a.text('Z',0,-275,190,'#727272');a.text('Z',180,-430,235,'#727272');save(a,'fx','zzz')
    for k in ['speech','round','thought']:
        a=Art();bubble(a,k);save(a,'fx','bubble-'+k)
    a=Art();bubble(a);a.text('Quack!',0,-145,160);save(a,'fx','bubble-quack')
    a=Art();bubble(a,'round',480,260)
    for xx in [-105,0,105]:a.put(oval(xx,-145,35,35),INK,'typing dot')
    save(a,'fx','bubble-typing')
    a=Art();a.blob(path('M0 -280 C-74 -176 -171 -40 0 0 C171 -40 74 -176 0 -280 Z'),'water','droplet');save(a,'fx','droplet')
    a=Art();a.blob(box(-32,-280,64,200,30),'amber','exclamation');a.blob(oval(0,-25,63,63),'amber','exclamation dot');save(a,'fx','exclamation')
    a=Art();a.blob(stroke(path('M-100 -235 C-110 -385 135 -385 100 -248 Q92 -200 0 -168 V-90'),43),'purple','question curve');a.blob(oval(0,-25,47,47),'purple','question dot');save(a,'fx','question')
    for k in ['bread','egg','heart','home','map','compass','camera','quack','flock','trophy','settings','sound','mute','flag','return','walk','location','wave','moon','sun']:
        a=Art()
        if k in ['bread','egg']:a=bread('loaf' if k=='bread' else 'egg')
        elif k=='heart':a.blob(heart_path(),'red','heart')
        elif k=='home':
            a.blob(box(-145,-220,290,220,30),'cream','house');a.blob(path('M-190 -210 Q-105 -280 0 -370 Q110 -280 190 -210 Z'),'red','roof');door(a,0,0,90,150)
        elif k=='map':
            a.blob(poly([(-200,-310),(-70,-350),(65,-290),(200,-330),(200,-40),(65,0),(-70,-55),(-200,-10)]),'cream','folded map');a.line(path('M-70 -350 V-55 M65 -290 V0'),w=T);a.line(path('M-160 -155 Q-60 -250 55 -130 T160 -210'),'#4794D8',18,'river')
        elif k=='compass':
            a.blob(oval(0,-180,360,360),'cream','compass rim');a.blob(poly([(0,-330),(78,-180),(0,-35),(-78,-180)]),'red','needle');a.blob(poly([(0,-180),(78,-180),(0,-35)]),'white','needle half',hi=0);a.put(oval(0,-180,30,30),INK,'needle pin')
        elif k=='camera':
            a.blob(box(-80,-335,160,70,20),'metal','camera top');a.blob(box(-210,-280,420,280,45),'blue','camera');a.blob(oval(0,-145,210,210),'metal','lens rim');a.blob(oval(0,-145,140,140),'water','lens');a.blob(box(130,-235,45,38,12),'cream','flash',hi=0)
        elif k=='quack':
            bubble(a,'round',420,260);a.blob(oval(-20,-165,105,88),'yellow','duck face');a.blob(oval(62,-158,80,40),'orange','beak');a.put(oval(-6,-183,10,12),INK,'eye')
        elif k=='flock':
            for xx,yy in [(-125,-65),(125,-65),(0,-180)]:a.blob(oval(xx,yy,150,150),'yellow','duck head');a.blob(oval(xx,yy+18,65,30),'orange','beak');a.put(oval(xx-30,yy-14,10,14),INK,'eye');a.put(oval(xx+30,yy-14,10,14),INK,'eye')
        elif k=='trophy':
            for xx in [-140,140]:a.line(oval(xx,-260,130,135),'#E38E12',30,'trophy handle')
            a.blob(box(-25,-160,50,145,18),'amber','trophy stem');a.blob(box(-125,-45,250,50,18),'amber','trophy foot');a.blob(path('M-150 -350 H150 Q150 -133 0 -130 Q-150 -133 -150 -350 Z'),'yellow','trophy cup')
        elif k=='settings':
            pts=[]
            for i in range(32):
                rr=185 if i%4 in [0,1] else 145;ang=i*math.tau/32;pts.append((rr*math.cos(ang),-185+rr*math.sin(ang)))
            a.blob(subtract(smooth(pts,tension=.2),oval(0,-185,130,130)),'metal','gear')
        elif k in ['sound','mute']:
            a.blob(poly([(-170,-240),(-90,-240),(30,-345),(30,-15),(-90,-120),(-170,-120)]),'blue','speaker')
            if k=='sound':
                a.line(path('M91 -270 Q194 -180 91 -90'),'#4794D8',20);a.line(path('M146 -330 Q310 -180 146 -30'),'#4794D8',20)
            else:a.line(path('M100 -260 L230 -100 M230 -260 L100 -100'),'#F0463F',24,'mute cross')
        elif k=='flag':
            a.blob(box(-150,-350,26,350,12),'metal','flag pole');a.blob(path('M-124 -350 Q0 -400 150 -330 L150 -130 Q0 -190 -124 -140 Z'),'purple','flag')
        elif k=='return':a.blob(path('M-100 -320 L-230 -200 L-100 -80 V-155 H10 Q180 -155 100 -25 Q310 -150 150 -250 Q95 -290 -100 -250 Z'),'blue','return arrow')
        elif k=='walk':
            for xx,yy,ang in [(-85,-240,-25),(85,-90,25)]:a.blob(transform(oval(0,0,118,230),dx=xx,dy=yy,angle=ang),'orange','footprint')
        elif k=='location':a.blob(subtract(path('M0 0 C-340 -290 -98 -475 0 -400 C98 -475 340 -290 0 0 Z'),oval(0,-285,105,105)),'red','location pin')
        elif k=='wave':
            a.blob(path('M-230 0 C-125 -30 -125 -260 18 -280 Q180 -270 135 -125 Q115 -237 28 -182 Q-5 -105 230 0 Z'),'water','wave')
        elif k=='moon':a.blob(subtract(oval(0,-190,350,380),oval(100,-250,300,340)),'purple','crescent')
        else:
            for i in range(8):
                ang=i*math.tau/8;a.line(poly([(math.cos(ang)*150,-185+math.sin(ang)*150),(math.cos(ang)*205,-185+math.sin(ang)*205)],False),'#E38E12',18,'sun ray')
            a.blob(oval(0,-185,240,240),'yellow','sun')
        save(a,'icons',k)

def main():
    build_food();build_nature()
    build_water();build_buildings();build_street();build_beach();build_tiles();build_fx_icons()
    data={'schema_version':1,'reference':{'file':'../drip-ref/svg/ducky_base-CyE3RFV7.svg','canvas':[713,937],'ground_anchor':[360,776],'visible_art_note':'The original stackable canvas has transparent top/bottom padding. Do not trim or resize the reference to an asset cell.','ink':INK,'outline_world_units':T},'palette':PAL,'anchor_convention':'Place at world position P with scale S: translate(P.x-anchor.x*S,P.y-anchor.y*S), then uniform scale S. SVG padding is 12 units, tiles have exact extents.','count':len(ASSETS),'assets':ASSETS}
    (ROOT/'assets/manifest.json').write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps({'count':len(ASSETS),'categories':{c:sum(a['category']==c for a in ASSETS) for c in sorted(set(a['category'] for a in ASSETS))}}))

if __name__=='__main__':main()
