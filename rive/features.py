"""Native asset library, ambient timelines, activity effects and touch artwork."""
from pathlib import Path
import ast
import json
import random
import xml.etree.ElementTree as ET
import importlib.util
import gen as G
import drip_style as D

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
count=100
def nid():
    global count
    count+=1
    return f'98:{count}'
D.nid=nid
G.nid=nid
G._pref[0]=5000
out=[]
def board(name,kids,w=1200,h=1200,origin=.5,animations=None,machine=None,vm=False):
    aid,style=nid(),nid()
    attrs=f' viewModelId="98:1" viewModelInstanceId="98:2"' if vm else ''
    if machine:
        attrs+=f' defaultStateMachineId="{machine[0]}"'
    out.extend([f'<Artboard name="{name}" id="{aid}" width="{w}" height="{h}" originX="{origin}" originY="{origin}" x="{90000+len(out)*5}" y="0" clip="false" styleId="{style}"{attrs}>',f'<LayoutComponentStyle id="{style}"/>']+kids+(animations or [])+(machine[1] if machine else [])+['</Artboard>'])
    return aid

# The activities session's hand-drawn slice, extracted without running its plaza generator.
source=(ROOT/'incoming/activities/rive/activities.py').read_text()
tree=ast.parse(source)
fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='bread')
scope={'D':D}
exec(compile(ast.Module(body=[fn],type_ignores=[]),'activity-bread','exec'),scope)
board('Golden Slice',scope['bread'](),100,100)

# Native expanding crumb ring, one independent instance per collection.
kids=[];tracks=[]
for i in range(7):
    import math
    a=i*math.tau/7
    shapeid,shape=D.shape('Bread crumb',0,0,D.path_xml(D.ellipse_pts(7,8,6)),D.fill('#F4D93B')+D.stroke())
    kids.append(shape)
    for key,values in [(13,[(0,0),(36,math.cos(a)*70)]),(14,[(0,0),(18,math.sin(a)*55-20),(36,math.sin(a)*70+20)]),(18,[(0,1),(22,1),(36,0)])]:
        tracks.append(f'<KeyedObject objectId="{shapeid}"><KeyedProperty propertyKey="{key}">'+''.join(f'<KeyFrameDouble frame="{f}" value="{v}"/>' for f,v in values)+'</KeyedProperty></KeyedObject>')
animid=nid();timeline=[f'<LinearAnimation name="Burst" id="{animid}" fps="60" duration="36" loopValue="0">']+tracks+['</LinearAnimation>']
sid,state=nid(),nid()
machine=[f'<StateMachine name="Burst" id="{sid}"><StateMachineLayer name="Crumbs"><AnyState x="0" y="-180"/><ExitState x="600" y="-180"/><EntryState x="-180" y="0"><StateTransition stateToId="{state}"/></EntryState><AnimationState id="{state}" animationId="{animid}" x="180" y="0"/></StateMachineLayer></StateMachine>']
board('Crumb Burst',kids,200,200,animations=timeline,machine=(sid,machine))

# Mobile's floating joystick art, no persistent action bar.
board('Joystick Base',[D.shape('Thumb ring',0,0,D.path_xml(D.ellipse_pts(88,88,16)),D.fill('#FFF4C5')+D.stroke(),extra=' opacity="0.65"')[1]],100,100)
board('Joystick Thumb',D.blob('Thumb',0,0,D.path_xml(D.ellipse_pts(34,34,12)),'yellow',34,shade=.23,hi=.05),50,50)

# One native transient activity panel. DOM supplies accessibility and hit targets.
def label(name,txt,x,y,size,bound=None):
    parts=G.text(name,txt,size,'FF232323',x,y)
    element=ET.fromstring('\n'.join(parts))
    if bound:
        ET.SubElement(element.find('TextValueRun'),'DataBindContext',sourcePathIds='98:1-'+bound,propertyKey='268')
    return [ET.tostring(element,encoding='unicode')]
panel=label('Activity message','Bread Hunt',-105,-4,18,'98:3')
panel+=label('Start','Start',198,-4,16,'98:4')+label('Leave','Leave',283,-4,16)
panel+=D.rect('Start button',198,0,85,46,'yellow',14)+D.rect('Leave button',283,0,74,46,'white',14)
panel+=D.rect('Activity card',0,0,670,76,'floor',22)
emptyid=nid()
empty=[f'<StateMachine name="Bindings" id="{emptyid}"><StateMachineLayer name="Bindings"><AnyState x="0" y="-180"/><ExitState x="400" y="-180"/><EntryState x="-180" y="0"/></StateMachineLayer></StateMachine>']
board('Activity Banner',panel,680,100,machine=(emptyid,empty),vm=True)
phone=label('Activity message','Bread Hunt',0,-24,15,'98:3')
phone+=label('Start','Start',-65,25,16,'98:4')+label('Leave','Leave',65,25,16)
phone+=D.rect('Start button',-65,25,112,44,'yellow',14)+D.rect('Leave button',65,25,112,44,'white',14)
phone+=D.rect('Activity card',0,0,340,104,'floor',22)
smid=nid()
bindings=[f'<StateMachine name="Bindings" id="{smid}"><StateMachineLayer name="Bindings"><AnyState x="0" y="-180"/><ExitState x="400" y="-180"/><EntryState x="-180" y="0"/></StateMachineLayer></StateMachine>']
board('Activity Banner Phone',phone,360,120,machine=(smid,bindings),vm=True)
out += ['<ViewModel name="ActivityVM" id="98:1" defaultInstanceId="98:2"><ViewModelPropertyString name="message" id="98:3"/><ViewModelPropertyString name="button" id="98:4"/><ViewModelInstance name="Default" id="98:2" exports="true"><ViewModelInstanceString viewModelPropertyId="98:3" propertyValue="Bread Hunt"/><ViewModelInstanceString viewModelPropertyId="98:4" propertyValue="Start"/></ViewModelInstance></ViewModel>']

# Life source's native birds, butterflies, leaves and splashes.
spec=importlib.util.spec_from_file_location('ambient',ROOT/'incoming/life/rive/ambient.py')
ambient=importlib.util.module_from_spec(spec);spec.loader.exec_module(ambient)
layers,anims=ambient.build()
sid,state=nid(),nid()
machine=[f'<StateMachine name="Ambient" id="{sid}"><StateMachineLayer name="Small lives"><AnyState x="0" y="-180"/><ExitState x="600" y="-180"/><EntryState x="-180" y="0"><StateTransition stateToId="{state}"/></EntryState><AnimationState id="{state}" animationId="6:1" x="180" y="0"/></StateMachineLayer></StateMachine>']
board('Small Lives',layers,1600,1000,origin=0,animations=anims,machine=(sid,machine))

# The activity team's inflatable, native bob, wake and paddle droplets.
floatkids=[];floattracks=[]
def ftrack(obj,key,values):
    floattracks.append(f'<KeyedObject objectId="{obj}"><KeyedProperty propertyKey="{key}">'+''.join(f'<KeyFrameDouble frame="{f}" value="{v}"/>' for f,v in values)+'</KeyedProperty></KeyedObject>')
floats=[]
for color in ['green','amber','purple','blue']:
    floats += D.group('City float',0,0,D.blob('Inflatable',0,-12,D.path_xml(D.ellipse_pts(142,62,12)),color,142,hi=.035))[1]
solo=nid()
floatkids=[f'<Solo name="City colour" id="{solo}"><DataBindContext sourcePathIds="98:10-98:11" propertyKey="296"/>']+floats+['</Solo>']
floatkids=D.blob('Float front',0,-8,D.path_xml([(-66,-3),(-48,11),(0,19),(48,11),(66,-3),(48,1),(0,8),(-48,1)]),'white',132,hi=.02)+floatkids
for j in range(4):
    obj,shape=D.shape('Paddle splash',0,0,D.path_xml(D.ellipse_pts(8,13,7)),D.fill('#FFFFFF')+D.stroke())
    floatkids.append(shape)
    ftrack(obj,13,[(0,(-1 if j%2 else 1)*56),(90,(-1 if j%2 else 1)*90),(180,(-1 if j%2 else 1)*56)])
    ftrack(obj,14,[(0,-8),(45,-30-j*10),(90,6),(135,-30-j*10),(180,-8)])
    ftrack(obj,18,[(0,0),(18,1),(70,0),(98,1),(160,0),(180,0)])
obj,shape=D.shape('Wake',0,13,D.path_xml(D.ellipse_pts(150,48,12)),D.stroke('#FFFFFF',2));floatkids.append(shape)
for key,values in [(16,[(0,.8),(180,1.6)]),(17,[(0,.8),(180,1.6)]),(18,[(0,0),(12,.8),(160,0),(180,0)])]:ftrack(obj,key,values)
bob,children=D.group('Float bob',0,0,floatkids);ftrack(bob,14,[(0,0),(45,-3),(90,0),(135,-3),(180,0)])
aid,sm,state=nid(),nid(),nid()
anims=[f'<LinearAnimation name="Lake life" id="{aid}" duration="180" fps="60" loopValue="1">']+floattracks+['</LinearAnimation>']
machine=[f'<StateMachine name="Float" id="{sm}"><StateMachineLayer name="Lake life"><AnyState x="0" y="-180"/><ExitState x="600" y="-180"/><EntryState x="-180" y="0"><StateTransition stateToId="{state}"/></EntryState><AnimationState id="{state}" animationId="{aid}" x="180" y="0"/></StateMachineLayer></StateMachine>']
ab=board('Race Float',children,300,200,animations=anims,machine=(sm,machine))
# Change only this board's VM from the general activity binding helper.
for index,line in enumerate(out):
    if line.startswith('<Artboard name="Race Float"'):
        out[index]=line.replace('>', ' viewModelId="98:10" viewModelInstanceId="98:13">',1)
out+=['<ViewModel name="Float VM" id="98:10" defaultInstanceId="98:13"><ViewModelPropertyNumber name="city" id="98:11"/><ViewModelInstance name="Default" id="98:13" exports="true"><ViewModelInstanceNumber viewModelPropertyId="98:11" propertyValue="0"/></ViewModelInstance></ViewModel>']

# Every delivered SVG is converted to native shapes. Keep full reusable library.
assetroot=ROOT/'assets'
manifestpath=assetroot/'manifest.json'
library=[]
if manifestpath.exists():
    manifest=json.loads(manifestpath.read_text())
    for index,asset in enumerate(manifest['assets']):
        path=ROOT/asset['file']
        if not path.exists():
            continue
        anchor=asset['anchor'];name='Asset '+asset['category']+'/'+asset['name']
        geometry=G.shapes_xml(G.drawables(str(path)),anchor['x'],anchor['y'])
        aid=board(name,geometry)
        out.append(f'<ComponentAsset name="{asset["name"]}" id="{nid()}" artboardId="{aid}"/>')
        library.append({**asset,'artboard':name,'scale':.24})
(HERE/'web/asset-library.json').write_text(json.dumps(library,separators=(',',':')))
(HERE/'features.rml').write_text('\n'.join(['<Rive version="1" kind="fragment">']+out+['</Rive>']))
print('Native features and SVG assets:',len(library))
