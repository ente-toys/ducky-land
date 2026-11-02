"""Add the life/crowd team's poses to the freshly generated canonical Ducky.

The main turn rig is never replaced by a session copy. All new artwork and
timelines live in a separate ID namespace and the canonical turn layer survives.
"""
from pathlib import Path
import xml.etree.ElementTree as ET
import importlib.util
import math
import gen as G

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
spec = importlib.util.spec_from_file_location('life_emotes', ROOT / 'incoming/life/rive/emotes.py')
life = importlib.util.module_from_spec(spec)
spec.loader.exec_module(life)
serial = 100
def nid(prefix=None):
    global serial
    serial += 1
    return f'97:{serial}'
G.nid = nid
doc = ET.parse(HERE / 'scene.rml')
root = doc.getroot()
duck = next(e for e in root if e.tag == 'Artboard')
named = {e.get('name'): e for e in duck.iter() if e.get('name')}
body, scene_root, face = named['Body'], named['Root'], named['Face']
original_machine = next(e for e in duck if e.tag == 'StateMachine')
original_action = next(e for e in original_machine if e.get('name') == 'Action')
original_walk = list(next(e for e in original_action if e.tag == 'BlendState1DViewModel').findall('BlendAnimation1D'))
walk_keys = getattr(G, 'WKEYS', getattr(G, 'TURN_KEYS', []))
if 'Shadow' not in named:
    shadow = ET.Element('Node', name='Shadow', id=nid())
    scene_root.append(shadow)
    G.IDS['Shadow'] = shadow.get('id')
    G.POS0['Shadow'] = (0, 0)
eyes = ET.Element('Node', name='Eyes', id=nid())
G.IDS['Eyes'] = eyes.get('id')
G.POS0['Eyes'] = (0, 0)
for name in ['EyeL T', 'EyeR T']:
    eye = named[name]
    face.remove(eye)
    eyes.append(eye)
face.insert(1, eyes)
scene_root.remove(named['Emote'])
faces, bubbles = life.art(G.node, G.text, nid, G.ROOT, G.ROOT if hasattr(G, 'REST') else G.BODY, G.EYES)
def elements(lines):
    return list(ET.fromstring('<Rive>' + '\n'.join(lines) + '</Rive>'))
# The official morph rig currently exposes wardrobe properties but has no outfit
# Solos. Restore the canonical Drip SVGs as a compatibility layer over that rig.
# Keep every morph path and the main rig's turn/layer state machines unchanged.
outfit_nodes=[]
if 'Cap' not in named:
    G._pref[0]=8000
    for name, items, prop in [('Cap',G.CAPS,'cap'),('Shades',G.SHADES,'shades'),('Acc',G.ACCS,'acc')]:
        node=elements(G.solo(name,items,G.BODY,G.ROOT,prop))[0]
        body.insert(0,node)
        outfit_nodes.append(name)
    for parent_name,name,left in [('FootA','Shoes L',True),('FootB','Shoes R',False),('FootBF','Shoes RF',False)]:
        if parent_name in named:
            pos=G.FOOT_L if left else G.FOOT_R
            named[parent_name].insert(0,elements(G.solo(name,[G.shoe_side(s,left) for s in G.SHOES],pos,pos,'shoes'))[0])
for element in reversed(elements(faces)):
    body.insert(3, element)
for element in reversed(elements(bubbles)):
    scene_root.insert(1, element)
for name in life.BUBBLES:
    G.POS0[name] = G.rel((606, 195), G.ROOT)
    G.POS0['Body'] = (0, 0)
quack, extras = life.tracks(G.tr, G.merge, G.QUACK, G.DANCE)

# Reuse only the crowd team's pose dictionaries, with the main rig's pivots.
section = (ROOT / 'incoming/crowd/poses.py').read_text()
G.POS0['FrontWing'] = (0, 0)
G.POS0['ClosedEyes'] = (0, 0)
scope = {'tr': G.tr, 'merge': G.merge}
exec(section, scope)
for name in ['SIT', 'LOOK', 'PREEN']:
    scope[name] = {key:value for key,value in scope[name].items() if key[0] not in {'FrontWing','ClosedEyes'} and key != ('WingR','op')}
animations = [('Idle', 0, 120, G.IDLE), ('Quack', 2, 75, quack), ('Dance', 3, 48, G.DANCE)]
animations += [(name, i + 4, duration, tracks) for i, (name, _, duration, tracks) in enumerate(extras)]
animations += [('Sit', 10, 180, scope['SIT']), ('Look', 11, 180, scope['LOOK']), ('Preen', 12, 144, scope['PREEN'])]
landing = {key: value for key, value in G.QUACK.items() if key[0] != 'Emote'}
animations += [('Landing', 13, 75, landing)]
channels = set(G.ALL)
for _, _, _, tracks in animations:
    channels.update(tracks)

def filled(tracks, duration):
    out = dict(tracks)
    for name, prop in channels:
        if (name, prop) in out:
            continue
        value = 1 if prop in ('sx', 'sy') else 0
        if prop == 'op':
            value = 0 if name in life.BUBBLES + ['SleepFace', 'LaughFace', 'AngryFace'] else 1
        if prop in ('x', 'y'):
            value = G.POS0.get(name, (0, 0))[0 if prop == 'x' else 1]
        out[name, prop] = [(0, value), (duration, value)]
    return out

# Replace action animations only. Keep all 33 turn poses and directional walks.
for element in list(duck):
    if element.tag == 'LinearAnimation' and (element.get('name') in {'Idle', 'Quack', 'Dance'} or element.get('name', '').startswith('Walk ')):
        duck.remove(element)
for name, index, duration, tracks in animations:
    duck.extend(elements(G.anim(name, f'97:{50000 + index}', duration, filled(tracks, duration))))
for i, (angle, tracks) in enumerate(zip(walk_keys, G.WALKS)):
    duck.extend(elements(G.anim(f'Walk {angle:g}', original_walk[i].get('animationId'), G.W, filled(tracks, G.W))))
machine = next(e for e in duck if e.tag == 'StateMachine')
action_layer = next(e for e in machine if e.get('name') == 'Action')
machine.remove(action_layer)
state_ids = {i: f'97:{60000+i}' for i in range(14)}
layer = ET.Element('StateMachineLayer', name='Action')
ET.SubElement(layer, 'AnyState', x='0', y='-250')
ET.SubElement(layer, 'ExitState', x='3000', y='-250')
entry = ET.SubElement(layer, 'EntryState', x='-200', y='0')
ET.SubElement(entry, 'StateTransition', stateToId=state_ids[0])
for i in range(14):
    if i == 1:
        state = ET.SubElement(layer, 'BlendState1DViewModel', id=state_ids[i], x=str(i*210), y='0')
        state.append(ET.fromstring(G.TURN_BIND))
        for original in original_walk:
            ET.SubElement(state, 'BlendAnimation1D', **original.attrib)
    else:
        state = ET.SubElement(layer, 'AnimationState', id=state_ids[i], animationId=f'97:{50000+i}', x=str(i*210), y='0')
    for j in range(14):
        if i == j:
            continue
        transition = ET.SubElement(state, 'BlendStateTransition' if i == 1 else 'StateTransition', stateToId=state_ids[j], duration='150')
        transition.append(ET.fromstring(G.cond(j)))
machine.insert(0, layer)
if outfit_nodes:
    turn_layer=ET.SubElement(machine,'StateMachineLayer',name='Wardrobe turn')
    ET.SubElement(turn_layer,'AnyState',x='0',y='-180')
    ET.SubElement(turn_layer,'ExitState',x='600',y='-180')
    entry=ET.SubElement(turn_layer,'EntryState',x='-180',y='0')
    ET.SubElement(entry,'StateTransition',stateToId='97:91000')
    blend=ET.SubElement(turn_layer,'BlendState1DViewModel',id='97:91000',x='180',y='0')
    blend.append(ET.fromstring(G.TURN_BIND))
    for i,angle in enumerate(range(-360,361,15)):
        a=math.radians(angle);front=math.cos(a);side=math.sin(a)
        opacity=1 if front>=.25 else 0
        tracks={}
        for name in outfit_nodes:
            tracks[name,'x']=[(0,G.BODY[0]-G.ROOT[0]+100*side)]
            tracks[name,'y']=[(0,G.BODY[1]-G.ROOT[1])]
            tracks[name,'sx']=[(0,max(.35,1-.4*abs(side)))]
            tracks[name,'op']=[(0,opacity)]
        aid=f'97:{92000+i}'
        duck.extend(elements(G.anim('Wardrobe '+str(angle),aid,1,tracks,linear=True)))
        ET.SubElement(blend,'BlendAnimation1D',animationId=aid,value=str(angle+360))
ET.SubElement(root, 'ComponentAsset', name='Drip Ducky', id='97:99999', artboardId='0:2')
vm = next(e for e in root if e.tag == 'ViewModel')
ET.SubElement(vm, 'ViewModelPropertyNumber', name='tagVisible', id='97:99997')
for instance in vm.findall('ViewModelInstance'):
    ET.SubElement(instance, 'ViewModelInstanceNumber', viewModelPropertyId='97:99997', propertyValue='1')
ET.SubElement(named['Tag'], 'DataBindContext', sourcePathIds='0:40-97:99997', propertyKey='18')
for city, color in [('Mumbai','FFE04A80'),('Delhi','FFAF6734'),('Hyderabad','FF727272'),('Pune','FF4794D8'),('Other','FF727272')]:
    named['Tag'].extend(elements(G.text('Tag '+city,' ducky ',78,'FFFFFFFF',0,0,bg=color,bind=f'{G.VM}-{G.VMP["name"]}')))
# Onboarding's isolated native arrival wrapper, scrubbed through a Joystick.
# It never competes with turn, walk, emotes or the grounded shadow.
flip=named['Flip'];flip_index=list(scene_root).index(flip);scene_root.remove(flip)
arrival=ET.Element('Node',name='Arrival',id='97:95000',x='0',y='0')
arrival.append(flip);scene_root.insert(flip_index,arrival);G.IDS['Arrival']='97:95000'
ET.SubElement(vm,'ViewModelPropertyNumber',name='arrival',id='97:95001')
for instance in vm.findall('ViewModelInstance'):
    ET.SubElement(instance,'ViewModelInstanceNumber',viewModelPropertyId='97:95001',propertyValue='1')
land={('Arrival','y'):[(0,-1150),(27,0),(37,-24),(49,0),(66,0)],('Arrival','sx'):[(0,.96),(25,.96),(29,1.18),(39,.98),(49,1),(66,1)],('Arrival','sy'):[(0,1.04),(25,1.04),(29,.78),(39,1.04),(49,1),(66,1)]}
duck.extend(elements(G.anim('Arrival Drop','97:95002',66,land,loop=0)))
joystick=ET.SubElement(duck,'Joystick',name='Landing progress',id='97:95003',x='1',xId='97:95002')
ET.SubElement(joystick,'DataBindContext',sourcePathIds='0:40-97:95001',propertyKey='299')
doc.write(HERE / 'scene.rml', encoding='unicode')
print('Extended canonical turn rig with 10 life/crowd/landing poses.')
