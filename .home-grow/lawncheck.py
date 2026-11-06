import json,re,math,sys
coast=json.load(open('.home-grow/shore-new.json'))['coast']; old=json.load(open('src/pixi/shore-lines.json'))['coast']
def inside(x,y,P):
    c=False
    for i in range(len(P)):
        a,b=P[i],P[i-1]
        if (a[1]>y)!=(b[1]>y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: c=not c
    return c
def dist(x,y,P):
    best=1e9
    for i in range(len(P)):
        a,b=P[i-1],P[i];dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy or 1)))
        best=min(best,math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))
    return best
src=open('.home-grow/orig/ground-r1-c1.svg').read()
def bbox(name):
    d=re.search(r'data-name="%s" d="([^"]+)"'%name,src).group(1);p=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',d)));return min(p[0::2]),max(p[0::2]),min(p[1::2]),max(p[1::2])
for arg in sys.argv[1:]:
    n,x,y=arg.split(':');x=float(x);y=float(y)
    x0,x1,y0,y1=bbox(n);w=(x1-x0)/2;h=(y1-y0)/2
    pts=[(x+w*math.cos(a)*.9,y+h*math.sin(a)*.9) for a in [i*math.pi/8 for i in range(16)]]
    m=min((dist(px,py,coast) if inside(px,py,coast) else -1) for px,py in pts)
    print(n,x,y,'min',round(m),'old-land share',sum(inside(px,py,old) for px,py in pts)/16)
