"""Native Drip emote art and keyed poses. No runtime drawing or scripts."""
import math
from drip_style import path_xml, poly_xml
INK='FF232323'
BUBBLES=['Emote','HeartBubble','LaughBubble','WaveBubble','SleepBubble','AngryBubble','PartyBubble']

def art(node,text,nid,ROOT,BODY,EYES):
    def shape(n,x,y,geo,col=None,stroke=7.5):
        p=(f'<Fill><SolidColor colorValue="{col}"/></Fill>' if col else '')
        if stroke: p+=f'<Stroke thickness="{stroke}" cap="round" join="round"><SolidColor colorValue="{INK}"/></Stroke>'
        return f'<Shape name="{n}" id="{nid()}" x="{x}" y="{y}">{geo}{p}</Shape>'
    def line(n,pts,x=0,y=0,w=9,col=INK):return shape(n,x,y,path_xml(pts,False),stroke=w).replace(f'colorValue="{INK}"',f'colorValue="{col}"')
    def ellipse(n,x,y,w,h,c):return shape(n,x,y,f'<Ellipse width="{w}" height="{h}"/>',c)
    def heart(x,y,s=1):
        pts=[(0,65),(-84,-3),(-76,-58),(-35,-72),(0,-43),(35,-72),(76,-58),(84,-3)]
        geo=path_xml([(a*s,b*s) for a,b in pts])
        # flat right side + tiny white highlight, same visual language as the base Ducky
        return [line('Heart highlight',[(-54,-36),(-48,-48),(-32,-48)],x,y,7,'FFFFFFFF'),shape('Heart',x,y,geo,'FFFF669D')]
    # Facial acting is under the outfit slots but above the original eyes.
    faces=[]
    closed=[line('Lid L',[(-111,0),(-86,10),(-62,0)]),line('Lid R',[(62,0),(86,10),(111,0)])]
    faces+=node('SleepFace',EYES,BODY,closed,extra=' opacity="0"')
    laugh=[line('Smile eye L',[(-113,10),(-88,-14),(-61,9)]),line('Smile eye R',[(61,9),(88,-14),(113,10)])]
    faces+=node('LaughFace',EYES,BODY,laugh,extra=' opacity="0"')
    angry=[line('Brow L',[(-122,-6),(-72,13)],w=13),line('Brow R',[(72,13),(122,-6)],w=13)]
    faces+=node('AngryFace',EYES,BODY,angry,extra=' opacity="0"')
    icons=[]
    icons.append(text('Quack','QUACK!',62,INK,0,-2))
    icons.append(heart(0,0))
    smile=[ellipse('Laugh eye L',-47,-27,17,25,INK),ellipse('Laugh eye R',47,-27,17,25,INK),
           ellipse('Tongue',0,49,42,16,'FFFF814A'),
           shape('Laugh mouth',0,23,path_xml([(-63,-3),(0,47),(63,-3),(0,7)]),'FF232323')]
    icons.append(smile)
    # Waving wing icon. Chunky feather fingers instead of a platform emoji.
    wingpts=[(-45,55),(-67,8),(-60,-27),(-43,-20),(-47,-65),(-28,-72),(-15,-33),(-9,-82),(12,-83),(19,-29),(36,-63),(54,-54),(42,-7),(61,-24),(78,-6),(52,51),(4,72)]
    icons.append([line('Wave motion L',[(-101,-10),(-110,-35),(-101,-59)],w=8),line('Wave motion R',[(95,-62),(109,-39),(105,-12)],w=8),shape('Hello wing',0,0,path_xml(wingpts),'FFF4D93B')])
    icons.append(text('Sleep z','z',72,INK,-66,30)+text('Sleep zz','z',98,INK,0,-4)+text('Sleep zzz','Z',106,INK,68,-25))
    icons.append([line('Anger top',[(-64,-58),(-16,-52),(-20,-12)],w=18),line('Anger right',[(65,-58),(20,-52),(23,-12)],w=18),line('Anger bottom L',[(-65,57),(-17,51),(-21,12)],w=18),line('Anger bottom R',[(65,57),(20,51),(23,12)],w=18)])
    party=[ellipse('Hat bobble',0,-71,23,23,'FFFF669D'),line('Party curl',[(45,45),(76,22),(89,35),(78,50),(63,43)],w=10),
           shape('Hat stripe',0,0,poly_xml([(-40,30),(29,-20),(44,13),(-50,48)]),'FFFF669D'),
           shape('Party hat',0,0,poly_xml([(-65,60),(0,-65),(66,60)],radius=9),'FF8E75DD')]
    # Confetti: flat strips, never glints or stars.
    for j,(x,y,c) in enumerate([(-108,-54,'FF4794D8'),(109,-34,'FFFF814A'),(-103,38,'FF58BF43'),(105,62,'FFF4D93B')]):
        party.insert(0,shape('Paper strip',x,y,poly_xml([(-6,-13),(6,-13),(6,13),(-6,13)],radius=3),c,4))
    icons.append(party)
    bubbles=[]
    for nm,icon in zip(BUBBLES,icons):
        bg='FFFFE8E5' if nm=='AngryBubble' else 'FFFFFFFF'
        # Pivot at tail attachment. Icon/card sit above it, so the pop feels rooted at the head.
        contents=[f'<Node name="Bubble artwork" id="{nid()}" y="-64">']+icon+[
            shape('Bubble card',0,0,'<Rectangle width="330" height="206" cornerRadiusTL="85"/>',bg),
            shape('Bubble tail',-99,99,poly_xml([(-27,-15),(31,-15),(-61,60)],radius=8),bg),'</Node>']
        bubbles+=node(nm,(606,195),ROOT,contents,extra=' opacity="0"')
    return faces,bubbles

def tracks(tr,merge,quack,dance):
    def bubble(n,dur):
        return merge(tr(n,'op',[(0,0),(5,0),(7,1),(dur-13,1),(dur-6,0),(dur,0)]),
          tr(n,'sx',[(0,.92),(5,.92),(12,1.16),(19,.97),(25,1),(dur-13,1),(dur,.94)]),
          tr(n,'sy',[(0,.92),(5,.92),(12,.88),(19,1.06),(25,1),(dur-13,1),(dur,.94)]),
          tr(n,'rot',[(0,-.10),(12,.055),(25,0),(dur-13,0),(dur,.05)]))
    def squash(dur,peak=16):
        return merge(tr('Body','sx',[(0,1),(5,1.17),(peak,.87),(peak+8,1.08),(peak+17,.98),(peak+24,1),(dur,1)]),
          tr('Body','sy',[(0,1),(5,.79),(peak,1.16),(peak+8,.93),(peak+17,1.03),(peak+24,1),(dur,1)]),
          tr('Tuft','rot',[(0,0),(7,-.22),(peak+3,.28),(peak+14,-.12),(peak+24,0),(dur,0)]))
    def face(n,dur,hide=True):
        d=tr(n,'op',[(0,0),(6,1),(dur-15,1),(dur-7,0),(dur,0)])
        if hide:d.update(tr('Eyes','op',[(0,1),(6,0),(dur-15,0),(dur-7,1),(dur,1)]))
        return d
    q=dict(quack);q.update(bubble('Emote',75))
    heart=merge(squash(86),bubble('HeartBubble',86),
        tr('Body','rot',[(0,0),(17,-.10),(42,.10),(65,0),(86,0)]),
        tr('WingL','rot',[(0,0),(15,.95),(35,1.12),(55,.95),(72,0),(86,0)]),tr('WingR','rot',[(0,0),(15,-.95),(35,-1.12),(55,-.95),(72,0),(86,0)]),
        tr('Beak','sx',[(0,1),(15,.75),(52,.75),(72,1),(86,1)]))
    laugh=merge(bubble('LaughBubble',90),face('LaughFace',90),
        tr('Body','sy',[(0,1),(6,.80),(14,1.12),(23,.82),(31,1.10),(40,.84),(48,1.10),(57,.87),(66,1.06),(77,1),(90,1)]),
        tr('Body','sx',[(0,1),(6,1.15),(14,.93),(23,1.14),(31,.94),(40,1.12),(48,.94),(57,1.10),(66,.98),(77,1),(90,1)]),
        tr('Body','rot',[(0,0),(14,-.10),(31,.10),(48,-.10),(66,.07),(90,0)]),
        tr('Beak','sy',[(0,1),(12,1.65),(23,1.1),(31,1.65),(40,1.1),(48,1.6),(66,1.1),(80,1),(90,1)]))
    wave=merge(squash(90),bubble('WaveBubble',90),
        tr('Body','rot',[(0,0),(12,-.08),(60,-.08),(82,0),(90,0)]),
        tr('WingR','rot',[(0,0),(10,-1.3),(19,-1.0),(28,-1.65),(37,-1.0),(46,-1.65),(55,-1.0),(64,-1.3),(78,0),(90,0)]),
        tr('WingL','rot',[(0,0),(12,.25),(64,.25),(82,0),(90,0)]))
    sleep=merge(bubble('SleepBubble',132),face('SleepFace',132),
        tr('Body','sy',[(0,1),(15,.84),(45,.90),(72,.84),(99,.90),(114,.84),(125,1.04),(132,1)]),
        tr('Body','sx',[(0,1),(15,1.12),(45,1.06),(72,1.12),(99,1.06),(114,1.12),(125,.98),(132,1)]),
        tr('Body','rot',[(0,0),(18,.12),(105,.12),(125,-.03),(132,0)]),
        tr('SleepBubble','y',[(0,0),(20,-5),(62,-27),(104,-48),(132,-64)]),
        tr('Tuft','rot',[(0,0),(18,.3),(105,.3),(125,-.10),(132,0)]))
    angry=merge(squash(88),bubble('AngryBubble',88),face('AngryFace',88),
        tr('Body','x',[(0,0),(10,0),(15,-10),(20,10),(25,-10),(30,10),(35,-9),(40,9),(45,-7),(50,7),(60,0),(88,0)]),
        tr('WingL','rot',[(0,0),(10,.85),(58,.85),(75,0),(88,0)]),tr('WingR','rot',[(0,0),(10,-.85),(58,-.85),(75,0),(88,0)]),
        tr('FootR','y',[(0,0),(32,-27),(39,0),(50,-27),(57,0),(88,0)]))
    party=merge(squash(102),bubble('PartyBubble',102),
        tr('Body','y',[(0,0),(5,0),(15,-92),(25,0),(32,0),(42,-70),(52,0),(60,0),(70,-88),(80,0),(102,0)]),
        tr('Body','rot',[(0,0),(15,-.17),(25,0),(42,.17),(52,0),(70,-.17),(92,0),(102,0)]),
        tr('WingL','rot',[(0,0),(12,1.8),(25,1.2),(42,1.9),(52,1.2),(70,1.9),(92,0),(102,0)]),
        tr('WingR','rot',[(0,0),(12,-1.2),(25,-1.8),(42,-1.2),(52,-1.9),(70,-1.2),(92,0),(102,0)]),
        tr('Shadow','sx',[(0,1),(15,.65),(25,1.12),(42,.70),(52,1.1),(70,.65),(80,1.1),(94,1),(102,1)]))
    for foot in ('FootL','FootR'):
        party.update(tr(foot,'y',[(0,0),(5,0),(15,-68),(25,0),(32,0),(42,-50),(52,0),(60,0),(70,-64),(80,0),(102,0)]))
    return q,[('Heart','0:24',86,heart),('Laugh','0:25',90,laugh),('Wave','0:26',90,wave),('Sleep','0:27',132,sleep),('Angry','0:28',88,angry),('Party','0:29',102,party)]
