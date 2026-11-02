"""Retain the activities lane's native result cards, countdown and +10 pops."""
from pathlib import Path
import copy
import re
import xml.etree.ElementTree as ET
HERE=Path(__file__).resolve().parent
source=ET.parse(HERE.parent/'incoming/activities/plaza.rml.reference').getroot()
race=next(e for e in source if e.get('name')=='Duck Race')
hunt=next(e for e in source if e.get('name')=='Bread Hunt')
vm=copy.deepcopy(next(e for e in source if e.tag=='ViewModel'))
vm.set('name','Activity Detail VM')
vmi=vm.find('ViewModelInstance').get('id')
counter=200000
def nid():
    global counter
    counter+=1
    return f'99:{counter}'
root=ET.Element('Rive',version='1',kind='fragment')
def board(name,nodes,animations):
    aid,style,sm=nid(),nid(),nid()
    a=ET.SubElement(root,'Artboard',name=name,id=aid,width='1600',height='1000',clip='false',styleId=style,viewModelId=vm.get('id'),viewModelInstanceId=vmi,defaultStateMachineId=sm)
    ET.SubElement(a,'LayoutComponentStyle',id=style)
    state=ET.SubElement(a,'StateMachine',name='Bindings',id=sm)
    layer=ET.SubElement(state,'StateMachineLayer',name='Bindings')
    ET.SubElement(layer,'AnyState',x='0',y='-180');ET.SubElement(layer,'ExitState',x='400',y='-180');ET.SubElement(layer,'EntryState',x='-180',y='0')
    a.extend(copy.deepcopy(nodes));a.extend(copy.deepcopy(animations))
board('Race Cards',[e for e in race if e.get('name')=='Results visibility' or e.get('name','').startswith('Countdown ')],[e for e in race if e.tag=='LinearAnimation' and e.get('name') in {'Results','Countdown'}])
board('Hunt Cards',[e for e in hunt if e.get('name')=='Results visibility'],[e for e in hunt if e.tag=='LinearAnimation' and e.get('name')=='Results'])
board('Collection Pops',[e for e in hunt if e.get('name','').startswith('Collection burst ')],[e for e in hunt if e.tag=='LinearAnimation' and e.get('name','').startswith('Pop ')])
root.append(vm)
mapping={e.get('id'):nid() for e in root.iter() if e.get('id') and not e.get('id').startswith('99:')}
text=ET.tostring(root,encoding='unicode')
text=re.sub(r'\b\d+:\d+\b',lambda m:mapping.get(m.group(),m.group()),text)
(HERE/'activity-cards.rml').write_text(text)
print('Imported native activity cards, countdown and collection pops.')
