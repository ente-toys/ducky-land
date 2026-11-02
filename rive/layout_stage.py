"""Arrange editable artboards without changing their local drawing coordinates."""
from pathlib import Path
import xml.etree.ElementTree as ET
HERE=Path(__file__).resolve().parent
index=0
for path in sorted(HERE.glob('*.rml')):
    tree=ET.parse(path)
    for artboard in tree.getroot().findall('Artboard'):
        artboard.set('x',str((index%12)*6500))
        artboard.set('y',str((index//12)*5000))
        index+=1
    for instance in tree.getroot().iter('ViewModelInstance'):
        if instance.get('viewModelId')!='0:40':
            continue
        authored={e.get('viewModelPropertyId') for e in instance}
        for prop,value in [('97:95001','1'),('97:99997','1'),('0:53','360')]:
            if prop not in authored:
                ET.SubElement(instance,'ViewModelInstanceNumber',viewModelPropertyId=prop,propertyValue=value)
    tree.write(path,encoding='unicode')
print('Editor stage laid out:',index,'artboards')
