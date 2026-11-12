"""Extract original illustrated duck layers; no Rive runtime or editor required."""
from pathlib import Path
import copy, json, math, re, sys, xml.etree.ElementTree as E
sys.dont_write_bytecode=True
from polish_svg import polish_svg
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/pixi-duck';OUT.mkdir(parents=True,exist_ok=True)
NS='{http://www.w3.org/2000/svg}'
E.register_namespace('',NS[1:-1])
ANGLES={9:0,10:-45,11:-90,12:-135,13:180,14:135,15:90,16:45}

def path_points(data):
    tokens=re.findall(r'[MLCHVZmlchvz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',data)
    pts=[];i=0;cmd='M';x=y=0
    while i<len(tokens):
        if tokens[i].isalpha():
            cmd=tokens[i];i+=1
            if cmd.upper()=='Z':continue
        count={'M':2,'L':2,'C':6,'H':1,'V':1}[cmd.upper()]
        vals=list(map(float,tokens[i:i+count]));i+=count
        if len(vals)<count:break
        if cmd.upper()=='H':x=vals[0]+(x if cmd.islower() else 0);pts.append((x,y))
        elif cmd.upper()=='V':y=vals[0]+(y if cmd.islower() else 0);pts.append((x,y))
        else:
            pairs=list(zip(vals[::2],vals[1::2]));pairs=[(a+(x if cmd.islower() else 0),b+(y if cmd.islower() else 0)) for a,b in pairs]
            pts.extend(pairs);x,y=pairs[-1]
    return pts

def points(el):
    tag=el.tag.replace(NS,'');pts=[]
    if tag in ('defs','mask','clipPath'):return []
    if tag=='path':pts=path_points(el.get('d',''))
    elif tag=='rect':
        x,y,w,h=[float(el.get(k,0)) for k in ('x','y','width','height')];pts=[(x,y),(x+w,y+h)]
    elif tag in ('circle','ellipse'):
        x,y=float(el.get('cx',0)),float(el.get('cy',0));rx=float(el.get('rx',el.get('r',0)));ry=float(el.get('ry',el.get('r',0)));pts=[(x-rx,y-ry),(x+rx,y+ry)]
    else:
        for child in el:pts.extend(points(child))
    for kind,value in reversed(re.findall(r'(translate|rotate|scale)\(([^)]+)\)',el.get('transform',''))):
        v=list(map(float,re.findall(r'[-+]?\d*\.?\d+',value)))
        if kind=='translate':pts=[(x+v[0],y+(v[1] if len(v)>1 else 0)) for x,y in pts]
        elif kind=='scale':pts=[(x*v[0],y*(v[1] if len(v)>1 else v[0])) for x,y in pts]
        else:
            a=math.radians(v[0]);cx=v[1] if len(v)>1 else 0;cy=v[2] if len(v)>2 else 0
            pts=[(cx+(x-cx)*math.cos(a)-(y-cy)*math.sin(a),cy+(x-cx)*math.sin(a)+(y-cy)*math.cos(a)) for x,y in pts]
    return pts

def bounds(el):
    p=points(el);return [min(x for x,y in p),min(y for x,y in p),max(x for x,y in p),max(y for x,y in p)]

def write_svg(name,elements,defs=()):
    wrapper=E.Element(NS+'g')
    for el in elements:wrapper.append(copy.deepcopy(el))
    b=bounds(wrapper);padding=max(3,max((float(el.get('stroke-width',0))/2+1 for el in wrapper.iter()),default=0));x,y=math.floor(b[0]-padding),math.floor(b[1]-padding);w,h=math.ceil(b[2]-x+padding),math.ceil(b[3]-y+padding)
    svg=E.Element(NS+'svg',{'width':str(w),'height':str(h),'viewBox':f'{x} {y} {w} {h}'})
    for definition in defs:svg.append(copy.deepcopy(definition))
    svg.append(wrapper)
    for el in svg.iter():el.attrib.pop('style',None)
    (OUT/name).write_text(polish_svg(E.tostring(svg,encoding='unicode'),name))
    return {'url':'/pixi-duck/'+name,'rect':[x,y,w,h]}

views=[]
for number,angle in ANGLES.items():
    path=ROOT/f'assets/duck-spin/clean/spin_{number}.svg';svg=E.parse(path).getroot()
    duck=next(g for g in svg.iter(NS+'g') if g.get('id','').startswith('Duck Spin'))
    while len(duck)<=2 and any(e.tag==NS+'g' for e in duck):duck=next(e for e in duck if e.tag==NS+'g')
    classified=[]
    for element in duck:
        p=points(element)
        if not p:continue
        b=bounds(element);w,h=b[2]-b[0],b[3]-b[1];fills={p.get('fill') for p in element.iter(NS+'path')}
        if fills=={'#232323'} and h<30 and b[1]>590:role='shadow'
        elif h>400:role='body'
        elif '#FF814A' in fills:role='foot' if b[1]>500 else 'beak'
        elif 'white' in fills and b[3]<140:role='tuft'
        elif fills=={'#232323'} and w<45 and h<45 and b[1]<320:role='eye'
        elif fills=={'#232323'} and b[1]>540:role='toe'
        elif '#FFD525' in fills and h<140 and b[1]>420:role='tail'
        elif '#FFD525' in fills:role='wing'
        else:role='other'
        classified.append((element,role,b))
    shadow=next(b for e,r,b in classified if r=='shadow');ground=[(shadow[0]+shadow[2])/2,(shadow[1]+shadow[3])/2+10.5]
    parts=[];counts={}
    for element,role,b in classified:
        count=counts.get(role,0);counts[role]=count+1
        cx,cy=(b[0]+b[2])/2,(b[1]+b[3])/2
        if role=='wing':
            upper=[p for p in points(element) if p[1]<b[1]+15];pivot=[sum(p[0] for p in upper)/len(upper),b[1]+10]
        elif role=='foot':pivot=[cx,b[1]+15]
        elif role=='tuft':pivot=[cx,b[3]-12]
        elif role in ('body','shadow','other','toe'):pivot=ground
        else:pivot=[cx,cy]
        part=write_svg(f'view-{number}-{role}-{count}.svg',[element]);part.update({'role':role,'id':f'{role}-{count}','pivot':pivot,'side':-1 if cx<ground[0] else 1,'bounds':b});parts.append(part)
    views.append({'angle':angle,'source':str(path.relative_to(ROOT)),'ground':ground,'parts':parts})

numbers={'cap':list(range(1,14)),'shades':[2,8,12],'acc':[4,5,8,9,10,11,12,6],'shoes':[1,2,5,6,7,8,9,10,11,12]}
names={'cap':['Captain’s cap','Aviator helmet','Green bandana','Black fedora','Purple headscarf','Ribbed beanie','Santa hat','Blue baseball cap','Pink fish hat','Purple cat cap','Spartan helmet','Silver headphones','Horned gaming headset'],'shades':['Round sunglasses','Heart sunglasses','Feather masquerade'],'acc':['Studded collar','Red electric guitar','Pink skateboard','Green scarf','Crossbody bag','Skull neckerchief','Sheathed sword','Orange laboratory flask'],'shoes':['Red sneakers','Blue loafers','Yellow sneakers','Blue sneakers','Pink sneakers','Yellow loafers','Red loafers','Pink loafers','Green sneakers','Green loafers']}
wardrobe=[]
for slot,values in numbers.items():
    prefix={'cap':'CAP','shades':'Shades','acc':'Acc','shoes':'Shoes'}[slot]
    for index,n in enumerate(values,1):
        source=next((ROOT/'drip-ref/svg').glob(f'{prefix} {n}-*.svg'));svg=E.parse(source).getroot();defs=[el for el in svg if el.tag.replace(NS,'') in ('defs','mask','clipPath')];drawable=[el for el in svg if points(el)]
        item={'id':f'{slot}-{n}','slot':slot,'index':index,'sourceNumber':n,'name':names[slot][index-1],'source':str(source.relative_to(ROOT))}
        if slot=='shoes':
            item['parts']=[]
            for side in [-1,1]:
                selected=[el for el in drawable if (-1 if sum(bounds(el)[::2])/2<355 else 1)==side]
                part=write_svg(f'{slot}-{n}-{side}.svg',selected,defs);part['side']=side;item['parts'].append(part)
        else:
            item['parts']=[write_svg(f'{slot}-{n}.svg',drawable,defs)]
        preview=list((ROOT/'drip-ref/svg').glob(f'{prefix.title() if slot=="cap" else prefix} prev {n}-*.svg'));item['aliases']=[str(p.relative_to(ROOT)) for p in preview]
        wardrobe.append(item)
from pixi_wardrobe_frames import build_frames
build_frames(views,wardrobe,OUT,write_svg,ROOT)
manifest={'version':2,'scale':1/3,'sourceCoordinateScale':.88,'sourceAnchor':[360,776],'views':views,'wardrobe':wardrobe}
(OUT/'manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
print(f'Extracted {len(views)} directions, {sum(len(v["parts"]) for v in views)} articulated layers, and {len(wardrobe)} wardrobe designs.')
