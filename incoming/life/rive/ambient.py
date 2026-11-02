"""Small deterministic native timelines. World art uses exactly the shared Drip kit."""
import math
import drip_style as D

def build():
    layers=[]; tracks=[]; frames=720
    def track(i,p,values,mode='linear'):
        tracks.append(f'<KeyedObject objectId="{i}"><KeyedProperty propertyKey="{p}">'+''.join(f'<KeyFrameDouble frame="{f}" value="{v:.5f}" interpolationType="{mode}"/>' for f,v in values)+'</KeyedProperty></KeyedObject>')
    def flight(i,x,y,j,span=90,high=28):
        track(i,13,[(f,x+span*math.sin(2*math.pi*f/720+j)) for f in range(0,721,6)])
        track(i,14,[(f,y+high*math.sin(4*math.pi*f/720+j*.7)) for f in range(0,721,6)])
        track(i,15,[(f,.13*math.cos(2*math.pi*f/720+j)) for f in range(0,721,6)])
    for j,(x,y) in enumerate([(399,148),(1165,117),(1407,346)]):
        kids=[]
        for side in [-1,1]:
            geo=D.path_xml([(0,0),(side*10,-18),(side*23,-11),(side*18,3),(side*7,9)])
            wid,wing=D.group('Bird wing',side*4,-1,D.blob('Feather',0,0,geo,'white',23,hi=.04))
            kids+=wing
            track(wid,15,[(f,side*(.4+.7*math.sin(2*math.pi*f/30+j))) for f in range(0,721,3)])
        kids=D.blob('Bird beak',11,-1,D.poly_xml([(-4,-4),(6,1),(-4,5)],radius=2),'amber',10,hi=0)+[D.shape('Bird eye',5,-4,'<Ellipse width="3" height="3"/>',D.fill(D.INK))[1]]+D.blob('Bird body',0,1,D.path_xml(D.ellipse_pts(24,17)),'white',24,hi=.05)+kids
        bid,bird=D.group('Flitting bird '+str(j),x,y,kids)
        layers+=bird;flight(bid,x,y,j)
    for j,(x,y,col) in enumerate([(205,409,'pink'),(1355,438,'purple')]):
        kids=[D.shape('Butterfly body',0,0,'<Ellipse width="4" height="15"/>',D.fill(D.INK))[1]]
        for side in [-1,1]:
            geo=D.path_xml([(0,-2),(side*6,-16),(side*15,-12),(side*13,0),(side*10,10),(side*3,9)])
            wid,wing=D.group('Butterfly wing',0,0,D.blob('Wing',0,0,geo,col,15,shade=.23,hi=.06))
            kids+=wing
            track(wid,16,[(f,.6+.36*math.sin(2*math.pi*f/24+j)) for f in range(0,721,3)])
        bid,bfly=D.group('Butterfly '+str(j),x,y,kids)
        layers+=bfly;flight(bid,x,y,j+1,44,30)
    for j,(x,y) in enumerate([(114,107),(242,55),(566,72),(1051,70),(1404,51),(1509,114)]):
        geo=D.path_xml([(-10,0),(-3,-9),(11,-8),(7,5),(-3,8)])
        kid=[D.shape('Leaf vein',0,0,D.path_xml([(-7,3),(6,-5)],False),D.stroke(D.INK,1.3))[1]]+D.blob('Falling leaf',0,0,geo,'amber' if j%3==0 else 'leaf',22,hi=.05)
        lid,leaf=D.group('Falling leaf '+str(j),x,y,kid)
        layers+=leaf
        xs=[];ys=[];rs=[];ops=[]
        # Six leaves with separate start phases. 8 sec drifting, 4 sec resting offscreen.
        for f in range(0,721,3):
            t=((f+j*109)%720)/480
            xs.append((f,x+30*t+24*math.sin(t*math.pi*4+j)))
            ys.append((f,y+235*t))
            rs.append((f,.6*math.sin(t*math.pi*5+j)))
            ops.append((f,0 if t>=1 else min(1,t*24,(1-t)*24)))
        for p,ks in [(13,xs),(14,ys),(15,rs),(18,ops)]:track(lid,p,ks)
    # Impacts at the ends of the fountain's ballistic drops. Ring + two tiny droplets.
    for side in [-1,1]:
        x=800+side*142;y=541
        sid,splash=D.group('Fountain splash',x,y,[D.shape('Splash ring',0,0,'<Ellipse width="39" height="10"/>',D.stroke('#FFFFFF',1.8))[1]])
        layers+=splash
        for p,fn in [(16,lambda t:.4+t*1.3),(17,lambda t:.5+t*.9),(18,lambda t:max(0,1-t*2))]:
            track(sid,p,[(f,fn(((f+12)%90)/90)) for f in range(0,721,3)])
        for j in range(2):
            did,drop=D.shape('Impact droplet',x,y,D.path_xml(D.ellipse_pts(5,8,6)),D.fill('#7FD0F3')+D.stroke())
            layers.append(drop)
            for p,fn in [(13,lambda t:x+(-1 if j==0 else 1)*22*t),(14,lambda t:y-65*t+80*t*t),(18,lambda t:1 if .04<t<.65 else 0)]:
                track(did,p,[(f,fn(((f+12)%90)/90)) for f in range(0,721,3)])
    anim=['<LinearAnimation name="Small lives" id="6:1" duration="720" fps="60" loopValue="1">']+tracks+['</LinearAnimation>']
    return layers,anim
