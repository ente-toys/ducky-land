#!/usr/bin/env python3
"""Convert EVERY SVG with the requested shared converter; build local proofs."""
import sys,json,xml.etree.ElementTree as ET
from pathlib import Path
from build_library import Art,path,svg_d,intersect,letters,box
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,'/Users/pragadees.xd/Developer/hallow-os/tools')
import svg2rml as S

def flattened_reference():
    source=ROOT.parent/'drip-ref/svg/ducky_base-CyE3RFV7.svg'
    root=ET.parse(source).getroot();NS='{http://www.w3.org/2000/svg}'
    masks={e.get('id'):e for e in root.iter() if e.tag==NS+'mask'}
    result=[]
    def walk(e,clip=None,opacity=1):
        tag=e.tag.replace(NS,'')
        if tag in ['mask','defs','clipPath']:return
        opacity*=float(e.get('opacity',1))
        mk=e.get('mask')
        if mk:
            mask=masks[mk[5:-1]];mp=path(mask.find(NS+'path').get('d'))
            clip=mp if clip is None else intersect(clip,mp)
        if tag=='path':
            p=path(e.get('d'));p=intersect(p,clip) if clip is not None else p
            fill=e.get('fill','#232323');fill='#FFFFFF' if fill=='white' else fill
            result.append(f'<path id="drip-{len(result)}" d="{svg_d(p)}" fill="{fill}" opacity="{opacity}"/>')
        else:
            for child in e:walk(child,clip,opacity)
    walk(root)
    out=ROOT/'reference';out.mkdir(exist_ok=True)
    out.joinpath('drip-ducky-flat.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="713" height="937" viewBox="0 0 713 937">\n'+'\n'.join(result)+'\n</svg>')
    return out/'drip-ducky-flat.svg'

def artboard(name,ident,w,h,content,x=0,y=0):
    return f'<Artboard name="{name}" id="0:{ident}" width="{w}" height="{h}" x="{x}" y="{y}" clip="true" styleId="0:{ident+1}"><LayoutComponentStyle name="Artboard Style" id="0:{ident+1}"/>{content}</Artboard>'

def main():
    m=json.loads((ROOT/'assets/manifest.json').read_text());allab=[];x=y=0;rowh=0
    for i,a in enumerate(m['assets']):
        data=(ROOT/a['file']).read_text();prefix=str(1000+i)
        frag,count=S.convert(data,a['category']+'/'+a['name'],prefix)
        target=ROOT/'rml'/a['category']/(a['name']+'.rml.frag');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(frag+'\n')
        a['rml_fragment']=str(target.relative_to(ROOT));a['rml_node_count']=count
        w=a['size']['width'];h=a['size']['height']
        if x+w>14000:x=0;y+=rowh+100;rowh=0
        allab.append(artboard(a['category']+'-'+a['name'],10+i*2,w,h,frag,x,y));x+=w+100;rowh=max(rowh,h)
    full=ROOT/'pipeline-all';full.mkdir(exist_ok=True)
    (full/'rive.yaml').write_text('name: ducky-asset-library\nmain: nature-tree-oak\n')
    (full/'scene.rml').write_text('<Rive version="1" kind="fragment">\n'+'\n'.join(allab)+'\n</Rive>\n')
    (ROOT/'assets/manifest.json').write_text(json.dumps(m,indent=2)+'\n')
    ref=flattened_reference()
    byname={a['name']:a for a in m['assets']}
    chosen=['tree-palm','bakery','bench-wood','float-duck','croissant']
    five=ROOT/'pipeline-five';five.mkdir(exist_ok=True)
    parts=[];svgs=[];scale=.32;base=1110;W=2800;H=1240
    positions=[40,960,1680,1980,2275]
    for i,(n,xx) in enumerate(zip(chosen,positions)):
        a=byname[n];ax=a['anchor']['x'];ay=a['anchor']['y'];left=xx;top=base-ay*scale
        frag,_=S.convert((ROOT/a['file']).read_text(),n,str(700+i),x=left,y=top,scale=scale)
        parts.append(frag)
        svgs.append(f'<g transform="translate({left} {top}) scale({scale})">'+(ROOT/a['file']).read_text().split('>',1)[1].rsplit('</svg>',1)[0]+'</g>')
    # The five imported world assets with the actual Drip source at true scale.
    refx=2500;refy=base-776*scale
    frag,_=S.convert(ref.read_text(),'Original Drip Ducky','799',x=refx,y=refy,scale=scale);parts.append(frag)
    svgs.append(f'<g transform="translate({refx} {refy}) scale({scale})">'+ref.read_text().split('>',1)[1].rsplit('</svg>',1)[0]+'</g>')
    # Caption and ground are vector paths too.
    a=Art();a.put(letters('DRIP / FIVE SVG IMPORTS',60,85,57,False),'#232323','title');a.put(letters('ONE WORLD SCALE',60,135,27,False),'#727272','subtitle')
    a.put(box(20,base+10,W-40,3,0,False),'#EFD58E','ground')
    for name,xx in zip(chosen,positions):a.put(letters(name.upper(),xx,base+73,25,False),'#232323','asset name')
    a.put(letters('DRIP DUCKY',refx,base+73,25,False),'#232323','reference label')
    xml=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">'+''.join(f'<path d="{svg_d(p)}" fill="{c}"/>' for _,p,c in a.layers)+'</svg>'
    caption,_=S.convert(xml,'Labels and ground','800');parts.insert(0,caption)
    # Earlier Rive siblings paint above later siblings.
    bg=f'<Shape name="Cream background" x="{W/2}" y="{H/2}"><Rectangle width="{W}" height="{H}"/><Fill><SolidColor colorValue="FFFFF4C5"/></Fill></Shape>'
    parts.append(bg)
    (five/'rive.yaml').write_text('name: ducky-five-imports\nmain: Five Imports\n')
    (five/'scene.rml').write_text('<Rive version="1" kind="fragment">'+artboard('Five Imports',2,W,H,'\n'.join(parts))+'</Rive>\n')
    (five/'expected.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"><path d="M0 0 H{W} V{H} H0Z" fill="#FFF4C5"/>'+''.join(svgs)+xml.split('>',1)[1].rsplit('</svg>',1)[0]+'</svg>')
    (five/'selection.json').write_text(json.dumps({'assets':chosen,'scale':scale,'converter':'/Users/pragadees.xd/Developer/hallow-os/tools/svg2rml.py','reference':'reference/drip-ducky-flat.svg'},indent=2)+'\n')
    print(f'Converted {len(allab)} SVGs. Five-import scene and complete {len(allab)}-artboard project written.')

if __name__=='__main__':main()
