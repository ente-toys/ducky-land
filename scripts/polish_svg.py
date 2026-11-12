import copy
import hashlib
import re
import xml.etree.ElementTree as E

NS='{http://www.w3.org/2000/svg}'
E.register_namespace('',NS[1:-1])


def pigment(value):
    value={'white':'#ffffff','black':'#000000'}.get(value,value)
    if not re.fullmatch(r'#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?',value):return None
    if len(value)==4:value='#'+''.join(c*2 for c in value[1:])
    return tuple(int(value[i:i+2],16) for i in (1,3,5))


def tint(rgb,amount):
    return '#'+''.join(f'{round(c+(255-c)*amount) if amount>=0 else round(c*(1+amount)):02x}' for c in rgb)


def material(context,rgb):
    r,g,b=rgb
    if g>r*1.12 and g>b*1.18 and any(s in context for s in ('tree','leaf','plant','lily','reeds','flower','canopy')):return 'leaf'
    if r>180 and g>115 and b<150 and any(s in context for s in ('bread','loaf','croissant','baguette','bun','food')):return 'bread'
    if r>g*1.12 and g>b*1.12 and any(s in context for s in ('wood','bench','trunk','plank','table','post','pole','frame','crate','hull','stall','sign')):return 'wood'
    if max(rgb)-min(rgb)<45 and r>=g>=b and any(s in context for s in ('library','lighthouse')):return 'masonry'
    if max(rgb)-min(rgb)<40 and any(s in context for s in ('rock','stone','fountain','step','shell')):return 'stone'
    if any(s in context for s in ('awning','umbrella','blanket','scarf','cap-','shoes-','canvas','sail')):return 'fabric'
    return None


def polish_svg(text,name):
    root=E.fromstring(text)
    if root.get('data-detail')=='1':return text
    root.set('data-detail','1')
    box=list(map(float,root.get('viewBox','0 0 600 600').split()))
    pitch=max(9,min(box[2:])/18)
    defs=root.find(NS+'defs')
    if defs is None:defs=E.Element(NS+'defs');root.insert(0,defs)
    gradients={};patterns={}
    def gradient(rgb):
        if rgb not in gradients:
            key='light-'+hashlib.sha1(bytes(rgb)).hexdigest()[:8];gradients[rgb]=key
            el=E.SubElement(defs,NS+'linearGradient',{'id':key,'x1':'0%','y1':'0%','x2':'85%','y2':'100%'})
            for offset,amount in [('0%',.23),('32%',.055),('68%',-.065),('100%',-.19)]:
                E.SubElement(el,NS+'stop',{'offset':offset,'stop-color':tint(rgb,amount)})
        return gradients[rgb]
    def pattern(kind):
        if kind in patterns:return patterns[kind]
        key='surface-'+kind;patterns[kind]=key;p=pitch
        el=E.SubElement(defs,NS+'pattern',{'id':key,'patternUnits':'userSpaceOnUse','width':str(p*2),'height':str(p*2)})
        if kind=='wood':
            E.SubElement(el,NS+'path',{'d':f'M0 {p*.3} C{p*.5} {p*.05} {p} {p*.65} {p*2} {p*.2} M{-p*.5} {p*1.5} C{p*.4} {p*1.2} {p*.9} {p*1.9} {p*2} {p*1.4}','fill':'none','stroke':'#613e26','stroke-width':str(max(.6,p*.025)),'opacity':'.21'})
            E.SubElement(el,NS+'ellipse',{'cx':str(p*1.2),'cy':str(p*.9),'rx':str(p*.17),'ry':str(p*.065),'fill':'none','stroke':'#754728','stroke-width':str(max(.5,p*.02)),'opacity':'.16'})
        elif kind=='leaf':
            E.SubElement(el,NS+'path',{'d':f'M{p*.2} {p*.5} C{p*.4} {p*.05} {p*.9} {p*.1} {p} {p*.4} M{p*1.2} {p*1.7} C{p*1.4} {p*1.2} {p*1.9} {p*1.25} {p*2} {p*1.6}','fill':'none','stroke':'#f6ffe4','stroke-width':str(max(.6,p*.035)),'opacity':'.15'})
        elif kind=='masonry':
            E.SubElement(el,NS+'path',{'d':f'M0 {p} H{p*2} M0 {p*2} H{p*2} M{p*.65} 0 V{p} M{p*1.65} {p} V{p*2}','fill':'none','stroke':'#8a7960','stroke-width':str(max(.45,p*.025)),'opacity':'.12'})
        elif kind in ('bread','stone'):
            for x,y,r in [(.3,.4,.045),(1.3,1.2,.06),(.8,1.8,.025)]:
                E.SubElement(el,NS+'circle',{'cx':str(p*x),'cy':str(p*y),'r':str(max(.5,p*r)),'fill':'#71583c' if kind=='bread' else '#505d5c','opacity':'.19'})
            E.SubElement(el,NS+'path',{'d':f'M{p*.8} {p*.25} l{p*.18} {-p*.04}','stroke':'#ffffff','stroke-width':str(max(.5,p*.03)),'opacity':'.22'})
        else:
            E.SubElement(el,NS+'path',{'d':f'M0 {p*.5} H{p*2} M{p*.5} 0 V{p*2}','fill':'none','stroke':'#ffffff','stroke-width':str(max(.45,p*.012)),'opacity':'.075'})
        return key
    def walk(parent,context):
        for node in list(parent):
            tag=node.tag.split('}')[-1]
            if tag in ('defs','mask','clipPath','linearGradient','pattern'):continue
            label=(context+' '+node.get('id','')+' '+node.get('data-name','')).lower()
            rgb=pigment(node.get('fill',''))
            if tag in ('path','rect','circle','ellipse','polygon') and rgb and min(rgb)>40 and min(rgb)<248:
                node.set('fill',f'url(#{gradient(rgb)})')
                kind=material(label,rgb)
                if kind:
                    overlay=copy.deepcopy(node);overlay.attrib.pop('id',None);overlay.attrib.pop('data-name',None)
                    overlay.set('fill',f'url(#{pattern(kind)})');overlay.set('stroke','none')
                    parent.insert(list(parent).index(node)+1,overlay)
            walk(node,label)
    walk(root,name)
    return E.tostring(root,encoding='unicode')+'\n'
