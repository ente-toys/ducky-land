"""Native Rive activity artboards. Run after plaza.py. No scripts or signed assets.

The browser only writes view model values and plays named native timelines.
Bread Hunt preserves the plaza; Duck Race is a separate, portable artboard.
"""
import copy
import math
from pathlib import Path
import xml.etree.ElementTree as E
import drip_style as D

HERE = Path(__file__).resolve().parent
D._n[0] = 50000
N = D.nid
PVM, PVI = '5:1', '5:2'
FONT = '0:90'
base = E.parse(HERE / 'plaza.rml').getroot()
vm = next(e for e in base if e.tag == 'ViewModel')
inst = vm.find('ViewModelInstance')
# Remove only a previous activity build, making this generator idempotent.
for e in list(vm):
    if e.get('id', '').startswith('92:'):
        vm.remove(e)
for e in list(inst):
    if e.get('viewModelPropertyId', '').startswith('92:'):
        inst.remove(e)
props = {}
def prop(name, kind='Number', default=0):
    pid = f'92:{100 + len(props)}'
    props[name] = pid
    E.SubElement(vm, 'ViewModelProperty' + kind, name=name, id=pid)
    E.SubElement(inst, 'ViewModelInstance' + kind, viewModelPropertyId=pid, propertyValue=str(default))
    return pid

for name in ['intro', 'result', 'counter']:
    prop(name, default=1 if name == 'intro' else 0)
for name, default in [('total', 'Chennai  0'), ('progress', '0 / 12'), ('resultTitle', 'Lovely haul!'),
                      ('resultSub', '+120 for Chennai'), ('hint', 'WASD / arrows or tap the ground'),
                      ('raceStatus', 'One lake. Eight Duckies. One winner.')]:
    prop(name, 'String', default)
for i in range(12):
    for key in ['x', 'y', 'show', 'px', 'py']:
        prop(f'b{i}{key}', default=-3000 if key in ['x', 'y', 'px', 'py'] else 0)
for i in range(8):
    prop(f'splash{i}')
    prop(f'row{i}', 'String', f'{i + 1}.  Ducky')
    prop(f'time{i}', 'String', '0:00.00')

def bind(name, key):
    return f'<DataBindContext sourcePathIds="{PVM}-{props[name]}" propertyKey="{key}"/>'

def text(label, value, size, x, y, color=D.INK, bound=None, ox=.5):
    tid, sid = N(), N()
    return [f'<Text name="{label}" id="{tid}" x="{x}" y="{y}" sizingValue="autoWidth" originX="{ox}" originY="0.5">',
            f'<TextStylePaint name="Gilroy" id="{sid}" fontAssetId="{FONT}" fontSize="{size}">{D.fill(color)}</TextStylePaint>',
            f'<TextValueRun name="Text" styleId="{sid}" text="{value}">{bind(bound, 268) if bound else ""}</TextValueRun></Text>']

def card(label, x, y, w, h, color='white'):
    return D.blob(label, x, y, D.poly_xml([(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)], radius=26), color, w, hi=.014)

def group(label, children, x=0, y=0, bound=None, opacity=1):
    gid = N()
    return gid, [f'<Node name="{label}" id="{gid}" x="{x}" y="{y}" opacity="{opacity}">',
                 bind(bound,18) if bound else ''] + children + ['</Node>']

EASE = '<CubicEaseInterpolator x1="0.16" y1="1" x2="0.3" y2="1"/>'
def anim(label, duration, tracks, loop=0):
    aid = N()
    out = [f'<LinearAnimation name="{label}" id="{aid}" duration="{duration}" fps="60" loopValue="{loop}">']
    for obj, channels in tracks.items():
        out.append(f'<KeyedObject objectId="{obj}">')
        for key, keys in channels.items():
            out.append(f'<KeyedProperty propertyKey="{key}">')
            for f, v in keys:
                out.append(f'<KeyFrameDouble frame="{f}" value="{v}" interpolationType="cubic">{EASE}</KeyFrameDouble>')
            out.append('</KeyedProperty>')
        out.append('</KeyedObject>')
    return aid, out + ['</LinearAnimation>']

def sm(aid):
    sid, state = N(), N()
    return sid, [f'<StateMachine name="Activity" id="{sid}"><StateMachineLayer name="Ambient">',
                 '<AnyState x="0" y="-180"/><ExitState x="500" y="-180"/>',
                 f'<EntryState x="-200" y="0"><StateTransition stateToId="{state}"/></EntryState>',
                 f'<AnimationState animationId="{aid}" id="{state}" x="200" y="0"/>',
                 '</StateMachineLayer></StateMachine>']

def intro(race=False):
    title = 'Duck Race' if race else 'Bread Hunt'
    lines = text('Activity', 'LAKE CLUB' if race else 'PLAZA BAKERY', 21, 800, 326, '#AF6734')
    lines += text('Title', title, 68, 800, 391)
    lines += text('How to play', 'Tap or press SPACE to paddle.' if race else 'A little waddle. A lot of bread.', 28, 800, 464)
    lines += text('Rules', 'Race up to seven Duckies around the lake.' if race else 'Collect 12 golden slices for your city.', 25, 800, 508)
    lines += text('Controls', 'Keep a steady rhythm. Every tap counts.' if race else 'WASD / arrows or tap the ground to walk.', 23, 800, 549, '#727272')
    lines += text('Start', 'Let\u2019s paddle' if race else 'Let\u2019s waddle', 28, 800, 629)
    lines += card('Start button',800,630,338,78,'yellow')
    lines += card('Intro card',800,482,700,444)
    return group('Instructions',lines,bound='intro')[1]

def result(race=False):
    lines = text('Result heading','Race results' if race else 'Lovely haul!',48,800,268,bound='resultTitle')
    lines += text('Result summary','A good day on the lake.' if race else '+120 for Chennai',25,800,319,bound='resultSub')
    if race:
        for i in range(8):
            y = 373 + i*43
            lines += text('Finish order',f'{i+1}.  Ducky',24,552,y,bound=f'row{i}',ox=0)
            lines += text('Finish time','0:00.00',23,1048,y,bound=f'time{i}',ox=1)
        by = 770
    else:
        lines += text('Collected','12 / 12 slices',34,800,463,bound='progress')
        lines += text('City total','Chennai  120',28,800,523,bound='total')
        by = 660
    lines += text('Play again','Race again' if race else 'Another basket?',27,800,by)
    lines += card('Replay button',800,by,360,72,'yellow')
    lines += text('Return','Back to activities',21,800,by+68,'#727272')
    lines += card('Results card',800,530 if race else 473,650,660 if race else 554)
    child, lines = group('Results spring', lines, x=800,y=500)
    # Pivot for a centred spring without moving all content coordinates.
    inner = E.fromstring('\n'.join(lines))
    for e in inner:
        if 'x' in e.attrib: e.set('x',str(float(e.get('x'))-800))
        if 'y' in e.attrib: e.set('y',str(float(e.get('y'))-500))
    _, out = group('Results visibility',[E.tostring(inner,encoding='unicode')],bound='result',opacity=0)
    aid, timeline = anim('Results',32,{child:{16:[(0,.94),(12,1.025),(24,1),(32,1)],17:[(0,.94),(12,1.025),(24,1),(32,1)],18:[(0,0),(8,1),(32,1)]}})
    return out, timeline

# Bread silhouette: rounded shoulders, pinched waist, little crust and crumb dots.
def bread():
    pts = [(-22,22),(22,22),(22,-5),(29,-11),(27,-24),(13,-31),(-12,-31),(-28,-24),(-29,-11),(-22,-5)]
    out=[]
    for x,y in [(-8,-8),(8,-10),(-3,7)]:
        out.append(D.shape('Crumb',x,y,D.path_xml(D.ellipse_pts(3,4,6)),D.fill('#F2BA3D'))[1])
    out += D.blob('Golden crumb',0,-2,D.path_xml([(x*.76,y*.78) for x,y in pts]),('{}'.format('#FFF4C5'),'#F4D93B'),44,hi=.03)
    out += D.blob('Golden crust',0,0,D.path_xml(pts),('{}'.format('#F4D93B'),'#F2BA3D'),58,hi=.05)
    return out

# Clone the actual plaza with its native ambient animation and all 16 Ducky slots.
plaza = next(e for e in base if e.tag=='Artboard' and e.get('name')=='Plaza')
hunt = copy.deepcopy(plaza)
ids = {e.get('id'):f'95:{i+1}' for i,e in enumerate(e for e in hunt.iter() if e.get('id'))}
for e in hunt.iter():
    for key,value in list(e.attrib.items()):
        if value in ids and key != 'sourcePathIds': e.set(key,ids[value])
hunt.set('name','Bread Hunt'); hunt.set('x','0'); hunt.set('y','2600'); hunt.set('clip','true')
ui = intro()
res, resanim = result()
ui = res + ui
counter = text('City bread','Chennai  0',24,800,54,bound='total')
counter += text('Basket','0 / 12',21,800,91,bound='progress')
counter += card('Tiny activity counter',800,69,268,92,'floor')
ui += group('Activity counter',counter,bound='counter',opacity=0)[1]
extra_anims=resanim
bread_nodes=[]
for i in range(12):
    bid,bob=group('Bread bob',bread())
    node = [f'<Node name="Slice {i}" id="{N()}" x="-3000" y="-3000" opacity="0">',bind(f'b{i}x',13),bind(f'b{i}y',14),bind(f'b{i}show',18)]
    node += bob + [D.shape('Ground shadow',0,27,D.path_xml(D.ellipse_pts(48,12)),D.fill('#EFD58E'))[1],'</Node>']
    bread_nodes += node
    _,t=anim(f'Bread bob {i}',100,{bid:{14:[(0,0),(50,-5),(100,0)]}},1)
    # Add bob track to the plaza Ambient timeline, so no host loop runs it.
    tr=E.fromstring('\n'.join(t)).find('KeyedObject')
    # The plaza ambient lasts 180 frames. Match its seam.
    for k in tr.iter('KeyFrameDouble'):
        k.set('frame',str(int(k.get('frame'))*180//100))
    hunt.find('LinearAnimation').append(tr)
    fx=[]; tracks={}
    label,tx=group('Floating +10',text('Ten bread','+10',32,0,-145,'#AF6734'),opacity=0)
    fx+=tx; tracks[label]={14:[(0,0),(50,-64)],18:[(0,1),(32,1),(50,0)],16:[(0,.9),(10,1.1),(20,1)],17:[(0,.9),(10,1.1),(20,1)]}
    # Six chunky crumb flecks, no sparkles or glow.
    for j in range(6):
        a=j*math.tau/6
        sid,s=D.shape('Crust fleck',0,-12,D.path_xml(D.ellipse_pts(7+(j%2)*3,6,6)),D.fill('#F4D93B')+D.stroke(),extra=' opacity="0"')
        fx.append(s)
        tracks[sid]={13:[(0,0),(18,math.cos(a)*52),(32,math.cos(a)*60)],14:[(0,-12),(18,-24+math.sin(a)*38),(32,math.sin(a)*42)],18:[(0,1),(15,1),(32,0)],15:[(0,0),(32,(j%2-.5)*2)]}
    fx=[f'<Node name="Collection burst {i}" id="{N()}" x="-3000" y="-3000">',bind(f'b{i}px',13),bind(f'b{i}py',14)] + fx + ['</Node>']
    ui+=fx
    _,t=anim(f'Pop {i}',50,tracks); extra_anims+=t
for e in reversed(list(E.fromstring('<X>'+''.join(ui)+'</X>'))): hunt.insert(1,e)
# Collectibles sit behind players, in front of plaza ground.
ducks_node=next(e for e in hunt if e.get('name')=='Ducks')
idx=list(hunt).index(ducks_node)+1
for e in E.fromstring('<X>'+''.join(bread_nodes)+'</X>'):
    hunt.insert(idx,e); idx+=1
for e in E.fromstring('<X>'+''.join(extra_anims)+'</X>'): hunt.append(e)

# Lake loop, still built out of the same Drip prop functions.
race_nodes=[]; race_anims=[]; ambient_tracks={}
res,ra=result(True); race_nodes+=res+intro(True); race_anims+=ra
countdown_tracks=[]
for i,num in enumerate(['3','2','1','GO!']):
    start=i*60
    lines=text('Countdown numeral',num,106,800,464)
    lines+=card('Countdown badge',800,470,240,180,'yellow')
    # Keep the squash pivot on the badge, so it does not slide while scaling.
    inner=E.fromstring('<X>'+''.join(lines)+'</X>')
    for e in inner:
        if 'x' in e.attrib: e.set('x',str(float(e.get('x'))-800))
        if 'y' in e.attrib: e.set('y',str(float(e.get('y'))-470))
    gid,kids=group('Countdown '+num,[E.tostring(e,encoding='unicode') for e in inner],x=800,y=470,opacity=0)
    race_nodes+=kids
    _,a=anim('unused',240,{gid:{18:[(0,0),(max(0,start-1),0),(start,1),(start+43,1),(start+59,0),(240,0)],16:[(0,.94),(start,.94),(start+9,1.04),(start+20,1),(240,1)],17:[(0,.94),(start,.94),(start+9,1.04),(start+20,1),(240,1)]}})
    # Merge into one timeline, played once by the host.
    countdown_tracks.append(E.tostring(E.fromstring('\n'.join(a)).find('KeyedObject'),encoding='unicode'))
# Pull the countdown objects out of the list into one valid native timeline.
race_anims += [f'<LinearAnimation name="Countdown" id="{N()}" duration="240" fps="60" loopValue="0">']+countdown_tracks+['</LinearAnimation>']

def duck_instance(k):
    dprops={'action':'0:41','cap':'0:42','shades':'0:43','acc':'0:44','shoes':'0:45','facing':'0:46','bg':'0:47','city':'0:48','isPlayer':'0:49','x':'0:50','y':'0:51','name':'0:52'}
    out=[f'<ViewModelInstance viewModelId="0:40" exports="true" name="Racer" id="{N()}">']
    for name,pid in dprops.items():
        kind='String' if name=='name' else 'Number'
        out.append(f'<ViewModelInstance{kind} viewModelPropertyId="{pid}" propertyValue="{ " ducky " if kind=="String" else (1 if name=="facing" else 0)}"><DataBindContext sourcePathIds="5:1-5:{10+k}-{pid}" propertyKey="{561 if kind=="String" else 575}"/></ViewModelInstance{kind}>')
    return out+['</ViewModelInstance>']

float_colors=['pink','yellow','blue','green','purple','red','amber','white']
for k in reversed(range(8)):
    # All coordinates are the water contact point; the native rig bobs above it.
    root=N(); bob=N()
    slot=[f'<Node name="Float slot {k}" id="{root}" x="-3000" y="-3000" scaleX="0.8" scaleY="0.8">',
          f'<DataBindContext sourcePathIds="5:1-5:{10+k}-0:50" propertyKey="13"/>',
          f'<DataBindContext sourcePathIds="5:1-5:{10+k}-0:51" propertyKey="14"/>',
          f'<Node name="Float bob" id="{bob}">']
    # Front bumper covers the feet, so the Ducky sits inside the float.
    slot+=D.blob('Float front',0,-8,D.path_xml([(-66,-3),(-48,11),(0,19),(48,11),(66,-3),(48,1),(0,8),(-48,1)]),'white',132,hi=.02)
    slot += [f'<NestedArtboard name="Ducky in float" id="{N()}" artboardId="0:2" isStateful="true" scaleX="0.19" scaleY="0.19" y="-5">'] + duck_instance(k) + ['<NestedStateMachine name="Paddle rig" animationId="0:7"/></NestedArtboard>']
    # Float colour follows city, keeping it correct when depth sorting swaps slots.
    slot += [f'<Solo name="City float" id="{N()}"><DataBindContext sourcePathIds="5:1-5:{10+k}-0:48" propertyKey="296"/>']
    for color in ['green','amber','purple','blue']:
        slot+=group('Float '+color,D.blob('Inflatable',0,-12,D.path_xml(D.ellipse_pts(142,62,12)),color,142,hi=.035))[1]
    slot+=['</Solo>','</Node>']
    ambient_tracks[bob]={14:[(0,0),(45,-3),(90,0),(135,-3),(180,0)]}
    # Splash jets and expanding ripple are native timed geometry, bound only for visibility.
    splash=[]
    for j in range(4):
        sid,s=D.shape('Paddle splash',0,0,D.path_xml(D.ellipse_pts(8,13,7)),D.fill('#FFFFFF')+D.stroke())
        splash.append(s)
        off=j*10
        ambient_tracks[sid]={13:[(0,(-1 if j%2 else 1)*56),(90,(-1 if j%2 else 1)*90),(180,(-1 if j%2 else 1)*56)],14:[(0,-8),(45,-30-off),(90,6),(135,-30-off),(180,-8)],18:[(0,0),(18,1),(70,0),(98,1),(160,0),(180,0)]}
    slot+=group('Paddling water',splash,bound=f'splash{k}',opacity=0)[1]
    rip,r=D.shape('Wake',0,13,D.path_xml(D.ellipse_pts(150,48,12)),D.stroke('#FFFFFF',2))
    slot+=[r,'</Node>']
    ambient_tracks[rip]={16:[(0,.8),(180,1.6)],17:[(0,.8),(180,1.6)],18:[(0,0),(12,.8),(160,0),(180,0)]}
    race_nodes+=slot

# Hand painted lake with a small island, reeds, and the plaza bakery at the shore.
race_nodes+=text('Lake name','The waddle circuit',33,800,95)
race_nodes+=text('Race status','One lake. Eight Duckies. One winner.',23,800,138,bound='raceStatus')
race_nodes+=group('Island tree',D.tree(31,62),800,548)[1]
race_nodes+=group('Island bush',D.bush(15,110),885,581)[1]
race_nodes+=group('Island flowers',D.planter(32,70),685,585)[1]
race_nodes+=D.blob('Island',800,560,D.path_xml(D.wobble(D.ellipse_pts(660,240,18),5,__import__('random').Random(9))),'grass',660,hi=.012)
for j in range(18):
    a=j*math.tau/18
    x,y=800+math.sin(a)*590,560+math.cos(a)*312
    race_nodes.append(D.shape('Loop marker',x,y,D.path_xml(D.ellipse_pts(11,6,6)),D.fill('#FFFFFF'))[1])
# Finish stripe across the near shore.
for j in range(56):
    x=328+(j%28)*35
    y=827+(j//28)*14
    race_nodes.append(D.shape('Finish checker',x,y,D.poly_xml([(-17.5,-7),(17.5,-7),(17.5,7),(-17.5,7)]),D.fill(D.INK if (j+j//28)%2 else '#FFFFFF'))[1])
race_nodes+=D.blob('Lake',800,560,D.path_xml(D.wobble(D.ellipse_pts(1330,770,22),5,__import__('random').Random(3))),'water',1330,hi=.015)
race_nodes+=D.blob('Lake bank',800,571,D.path_xml(D.ellipse_pts(1400,825,22)),'floor',1400,hi=.012)
for x,y,s in [(100,260,1),(1500,240,2),(100,940,3),(1500,960,4)]:
    race_nodes+=group('Shore tree',D.tree(s,75),x,y)[1]
race_nodes.append(D.shape('Grass',800,500,D.poly_xml([(-810,-510),(810,-510),(810,510),(-810,510)]),D.fill(D.PAL['grass'][0]))[1])
aid,ambient=anim('Lake life',180,ambient_tracks,1)
sid,machine=sm(aid)
race=[f'<Artboard name="Duck Race" id="{N()}" width="1600" height="1000" x="1800" y="2600" clip="true" styleId="93:1" viewModelId="{PVM}" viewModelInstanceId="{PVI}" defaultStateMachineId="{sid}">','<LayoutComponentStyle name="Artboard style" id="93:1"/>']+machine+race_nodes+ambient+race_anims+['</Artboard>']

for e in list(base):
    if e.get('name') in ['Bread Hunt','Duck Race']: base.remove(e)
base.append(hunt)
base.append(E.fromstring('\n'.join(race)))
if not any(e.tag=='ComponentAsset' for e in base):
    E.SubElement(base,'ComponentAsset',name='Drip Ducky',artboardId='0:2',id='93:2')
E.indent(base)
E.ElementTree(base).write(HERE/'plaza.rml',encoding='unicode')
print('Built Bread Hunt and Duck Race with native pops, bobs, splashes, countdown and results.')
