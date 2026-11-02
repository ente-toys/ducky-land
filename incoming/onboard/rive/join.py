"""Native Rive wardrobe stage and postcard frames. No scripts or signed build."""
import os
import gen

HERE = os.path.dirname(os.path.abspath(__file__))
INK, CREAM, YELLOW = 'FF232323', 'FFFFF4C5', 'FFF4D93B'
counter = 100
def nid():
    global counter
    counter += 1
    return f'9:{counter}'
def rect(name, x, y, w, h, color, radius=0, stroke=False):
    return f'<Shape name="{name}" id="{nid()}" x="{x}" y="{y}"><Rectangle width="{w}" height="{h}" cornerRadiusTL="{radius}"/><Fill><SolidColor colorValue="{color}"/></Fill>' + (f'<Stroke thickness="3"><SolidColor colorValue="{INK}"/></Stroke>' if stroke else '') + '</Shape>'
def text(value, x, y, size, ox=0, bind=None):
    sid = nid()
    db = f'<DataBindContext sourcePathIds="9:1-{bind}" propertyKey="268"/>' if bind else ''
    return f'<Text name="{value}" id="{nid()}" x="{x}" y="{y}" originX="{ox}" originY="0.5" sizingValue="autoWidth"><TextStylePaint name="Type" id="{sid}" fontSize="{size}" fontAssetId="0:90" lineHeight="{size * 1.3}"><Fill><SolidColor colorValue="{INK}"/></Fill></TextStylePaint><TextValueRun name="Label" styleId="{sid}" text="{value}">{db}</TextValueRun></Text>'
def machine(sid, name):
    return f'<StateMachine name="{name}" id="{sid}"><StateMachineLayer name="Bindings"><AnyState x="0" y="-200"/><ExitState x="400" y="-200"/><EntryState x="-200" y="0"/></StateMachineLayer></StateMachine>'

placement = [f'<NestedArtboard artboardId="0:2" isStateful="true" name="Your Drip Ducky" id="{nid()}" x="340" y="610" scaleX="0.9" scaleY="0.9"><ViewModelInstance name="Wardrobe Ducky" exports="true" id="{nid()}" viewModelId="{gen.VM}">']
for pk, pid in gen.VMP.items():
    string = pk in gen.STRINGS
    tag = 'String' if string else 'Number'
    val = 'ducky' if string else (1 if pk in ('facing','arrival') else 0)
    placement.append(f'<ViewModelInstance{tag} viewModelPropertyId="{pid}" propertyValue="{val}"><DataBindContext sourcePathIds="{gen.VM}-{pid}" propertyKey="{561 if string else 575}"/></ViewModelInstance{tag}>')
placement += ['</ViewModelInstance><NestedStateMachine name="Ducky" animationId="0:7"/></NestedArtboard>']
doc = ['<Rive version="1" kind="fragment">', f'<Artboard name="Wardrobe" id="9:10" x="3600" y="0" width="680" height="690" styleId="9:11" defaultStateMachineId="9:12" viewModelId="{gen.VM}" viewModelInstanceId="{gen.VMI}"><LayoutComponentStyle name="Wardrobe" id="9:11"/>', machine('9:12', 'Wardrobe')] + placement + ['</Artboard>']

for index, (name, w, h, top, photo_h, title_size) in enumerate([('Photo Wide',1600,900,158,622,66), ('Photo Square',1200,1200,158,902,54)]):
    ab, style, sm = f'9:{20+index*3}', f'9:{21+index*3}', f'9:{22+index*3}'
    doc += [f'<Artboard name="{name}" id="{ab}" x="{4500+index*1800}" y="0" width="{w}" height="{h}" styleId="{style}" defaultStateMachineId="{sm}" viewModelId="9:1" viewModelInstanceId="9:2"><LayoutComponentStyle name="Card" id="{style}"/>', machine(sm,'Card')]
    doc += [text('my ducky in Ducky Land',48,87,title_size), text('ducky · Kochi',48,h-64,36,bind='9:3'), text('Ducky Land',w-48,h-64,28,ox=1)]
    doc += [rect('Photo ink',w/2,top+photo_h/2,w-92,photo_h+4,'FFFFFFFF',28,True), rect('Postcard',w/2,h/2,w-6,h-6,CREAM,32,True), '</Artboard>']
doc += ['<ViewModel name="PhotoVM" id="9:1" defaultInstanceId="9:2"><ViewModelPropertyString name="signature" id="9:3"/><ViewModelInstance name="Default" exports="true" id="9:2"><ViewModelInstanceString viewModelPropertyId="9:3" propertyValue="ducky · Kochi"/></ViewModelInstance></ViewModel>', '</Rive>']
with open(os.path.join(HERE,'join.rml'),'w') as f:
    f.write('\n'.join(doc))
print('wrote native wardrobe and photo card artboards')
