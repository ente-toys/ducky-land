import json,sys,math
sys.path.insert(0,'.home-grow'); from field import D
w=json.load(open('src/pixi/walk-shapes.json')); c=w['coast']; out=[]
for i,a in enumerate(c):
    b=c[(i+1)%len(c)]; n=max(1,int(math.hypot(b[0]-a[0],b[1]-a[1])//100))
    for k in range(n):
        x=a[0]+(b[0]-a[0])*k/n; y=a[1]+(b[1]-a[1])*k/n; dx,dy=D(x,y)
        if abs(dx)<.5 and abs(dy)<.5:
            if k==0: out.append(a)
            continue
        out.append([round(x+dx),round(y+dy)])
f=lambda p:'['+','.join('[%d,%d]'%(a,b) for a,b in p)+']'
open('rive/web/home-bigger/walk-shapes.json','w').write('{\n"coast": '+f(out)+',\n"lake": '+f(w['lake'])+'\n}\n')
A=lambda p:abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p))))/2
print('walk coast', len(c), '->', len(out), 'area', A(c), '->', A(out), round(A(out)/A(c),3))
