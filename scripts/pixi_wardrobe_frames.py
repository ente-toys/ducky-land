import copy
import json
import math
from pathlib import Path
import subprocess
import xml.etree.ElementTree as E

NS='{http://www.w3.org/2000/svg}'
INK='#232323'


def path(d,fill='none',stroke=INK,width=5):
    return E.Element(NS+'path',{'d':d,'fill':fill,'stroke':stroke,'stroke-width':str(width),'stroke-linejoin':'round','stroke-linecap':'round'})


def ellipse(x,y,rx,ry,fill,stroke=INK,width=5):
    return E.Element(NS+'ellipse',{'cx':str(x),'cy':str(y),'rx':str(rx),'ry':str(ry),'fill':fill,'stroke':stroke,'stroke-width':str(width)})


def group(elements,transform):
    node=E.Element(NS+'g',{'transform':transform})
    node.extend(copy.deepcopy(elements))
    return node


def source(spec,out):
    root=E.parse(out/Path(spec['url']).name).getroot()
    return list(root.find(NS+'g')),[e for e in root if e.tag!=NS+'g']


def headgear(n,angle,m,part,out):
    a=math.radians(angle);front=abs(angle)<90;rear=abs(angle)>90;profile=abs(angle)==90
    x=sum(m['head'])/2;shift=math.sin(a);rim=-515+(m['headY']+559.5762)
    elements=[]
    if n in (4,5,6,7,10) or angle==0 and n not in (12,13):
        art,defs=source(part,out)
        if not front and n==10:art=[el for i,el in enumerate(art) if i not in {1,4,6,7,8}]
        sx=.96 if abs(angle)==45 else 1
        if rear or profile and angle>0:sx=-1
        elements=[group(art,f'translate({x} {m["headY"]+559.5762}) scale({sx} 1) translate({-360/.88} {-776/.88-10.5}) scale({1/.88})')]
        return elements,defs
    if n==1:
        elements=[path(f'M{x-175} {rim-5} C{x-195} {rim-145} {x+175} {rim-145} {x+175} {rim-5}Z','#449DD7'),path(f'M{x-172} {rim-10} C{x-65} {rim+7} {x+65} {rim+7} {x+172} {rim-10} L{x+172} {rim+10} C{x+55} {rim+25} {x-55} {rim+25} {x-172} {rim+10}Z','#3D3939')]
        if not rear:
            s=1 if angle>0 else -1
            elements.append(path(f'M{x+s*130} {rim+5} L{x+s*245} {rim+27} C{x+s*250} {rim+45} {x+s*155} {rim+35} {x+s*105} {rim+20}Z','#3D3939'))
        if front:
            bx=x+math.sin(a)*95
            elements.extend([ellipse(bx,rim-61,22,29,'#F2BA3D'),path(f'M{bx} {rim-80} L{bx} {rim-42} M{bx-12} {rim-60} L{bx+12} {rim-60}','none',INK,3)])
    elif n==2:
        elements=[path(f'M{x-160} {rim+8} C{x-180} {rim-145} {x+180} {rim-145} {x+160} {rim+8} L{x+143} {rim+175} L{x+110} {rim+180} L{x+105} {rim+15} C{x+20} {rim-1} {x-80} {rim-1} {x-160} {rim+8}Z','#AF6734')]
        if rear:
            elements=[path(f'M{x-170} {rim+5} C{x-185} {rim-143} {x+185} {rim-143} {x+170} {rim+5} L{x+155} {rim+175} L{x+126} {rim+180} L{x+120} {rim+15} L{x-120} {rim+15} L{x-126} {rim+180} L{x-155} {rim+175}Z','#AF6734'),path(f'M{x} {rim-100} C{x-7} {rim-70} {x-7} {rim-25} {x} {rim+5}','none','#784626',4)]
        else:
            s=1 if angle<0 else -1
            elements=[group(elements,f'translate({x} 0) scale({s} 1) translate({-x} 0)')]
            ex=x+s*115
            elements.extend([path(f'M{ex-22} {rim+4} C{ex-23} {rim-30} {ex+22} {rim-30} {ex+22} {rim+4} L{ex+20} {rim+100} C{ex+17} {rim+125} {ex-20} {rim+125} {ex-22} {rim+100}Z','#E5E5E5'),path(f'M{x-s*145} {rim-66} L{ex} {rim-36}','none','#784626',13),ellipse(x-s*150,rim-66,24,36,'#3D3939','#AF6734',10)])
    elif n==3:
        y=rim+22
        elements=[path(f'M{x-171} {y} C{x-80} {y-38} {x+83} {y-38} {x+171} {y} L{x+171} {y+38} C{x+72} {y+11} {x-80} {y+11} {x-171} {y+38}Z','#58BF43')]
        k=x+math.cos(a)*-165
        if rear or angle<=0:elements.extend([path(f'M{k} {y+19} L{k-50} {y-3} L{k-29} {y+31} L{k-56} {y+50} L{k-3} {y+37}Z','#58BF43'),ellipse(k,y+26,13,12,'#58BF43')])
    elif n==8:
        elements=[path(f'M{x-160} {rim+5} C{x-170} {rim-152} {x+170} {rim-152} {x+160} {rim+5} C{x+65} {rim-15} {x-65} {rim-15} {x-160} {rim+5}Z','#4794D8')]
        if not rear:
            s=1 if angle>0 else -1
            elements.append(path(f'M{x+s*145} {rim-3} L{x+s*255} {rim+12} C{x+s*261} {rim+32} {x+s*165} {rim+26} {x+s*116} {rim+14}Z','#4794D8'))
            if front:
                bx=x+math.sin(a)*88
                elements.append(path(f'M{bx-21} {rim-23} L{bx-21} {rim-48} C{bx-5} {rim-57} {bx+10} {rim-57} {bx+21} {rim-48} L{bx+21} {rim-23}Z','#F4D93B'))
        else:elements.extend([path(f'M{x-45} {rim+3} C{x-45} {rim-49} {x+45} {rim-49} {x+45} {rim+3}','#FFD525'),path(f'M{x-150} {rim-5} C{x-90} {rim-18} {x-50} {rim-18} {x-45} {rim-5} M{x+45} {rim-5} C{x+85} {rim-18} {x+130} {rim-18} {x+150} {rim-5}')])
    elif n==9:
        y=rim-8
        s=1 if angle>0 else -1
        elements=[path(f'M{x-190} {y+79} C{x-247} {y-105} {x-136} {y-155} {x} {y-145} C{x+136} {y-155} {x+247} {y-105} {x+190} {y+79} C{x+94} {y+113} {x-94} {y+113} {x-190} {y+79}Z','#EF8DB7'),path(f'M{x-160} {y-38} L{x-233} {y-72} L{x-233} {y+29}Z','#EF8DB7'),path(f'M{x+160} {y-38} L{x+233} {y-72} L{x+233} {y+29}Z','#EF8DB7'),path(f'M{x-60} {y-140} L{x-25} {y-179} L{x+33} {y-170} L{x+65} {y-140}Z','#E86C9E')]
        if not rear:
            hole=E.Element(NS+'mask',{'id':'face-opening','maskUnits':'userSpaceOnUse','x':str(x-260),'y':str(y-200),'width':'520','height':'400'})
            hole.append(E.Element(NS+'rect',{'x':str(x-260),'y':str(y-200),'width':'520','height':'400','fill':'white'}))
            hole.append(ellipse(x+s*145,y+91,147,111,'black',stroke='black',width=0))
            wrapped=E.Element(NS+'g',{'mask':'url(#face-opening)'});wrapped.extend(elements[:1]);elements[:1]=[wrapped]
            fx=x+s*154
            elements.extend([ellipse(fx,y-72,19,25,'white'),ellipse(fx+s*5,y-72,6,10,INK,width=0)])
            return elements,[hole]
    elif n==11:
        elements=[path(f'M{x-40} {rim-90} C{x-49} {rim-213} {x+50} {rim-213} {x+43} {rim-90}Z','#AF5750'),path(f'M{x-175} {rim+65} L{x-175} {rim-15} C{x-180} {rim-157} {x+180} {rim-157} {x+175} {rim-15} L{x+175} {rim+65} L{x+110} {rim+48} L{x+110} {rim-4} C{x+30} {rim+6} {x-30} {rim+6} {x-110} {rim-4} L{x-110} {rim+48}Z','#B8945D')]
        if profile:
            fx=x+(1 if angle>0 else -1)*140
            elements.append(path(f'M{fx} {rim-26} L{fx} {rim+73} L{fx-15*math.sin(a)} {rim+70}', '#B8945D'))
    elif n in (12,13):
        y=rim+57;blue=n==13;color='#5D6CF9' if blue else '#DBDBDB'
        elements=[path(f'M{x-166} {y} C{x-179} {y-165} {x+179} {y-165} {x+166} {y}','none',INK,17),path(f'M{x-166} {y} C{x-179} {y-165} {x+179} {y-165} {x+166} {y}','none',color,9)]
        positions=[x+math.sin(a)*45] if profile else [x-170,x+170]
        for ex in positions:
            elements.extend([ellipse(ex,y+12,49,65,INK),ellipse(ex,y+12,37,51,color),path(f'M{ex-20} {y-13} C{ex-28} {y+37} {ex+28} {y+37} {ex+20} {y-13}','none','#495287' if blue else '#888888',4)])
            if blue:
                outward=-1 if ex<x else 1
                elements.append(path(f'M{ex+outward*31} {y-37} C{ex+outward*66} {y-51} {ex+outward*62} {y-83} {ex+outward*58} {y-100} C{ex+outward*40} {y-73} {ex+outward*15} {y-70} {ex+outward*6} {y-49}Z','#495287'))
        if blue and not rear:
            ex=positions[-1]
            elements.extend([path(f'M{ex} {y+42} C{ex-8} {y+87} {x+35} {y+88} {x+13} {y+77}','none',INK,9),ellipse(x+13,y+77,12,8,INK)])
    return elements,[]


def neckwear(n,angle,m):
    a=math.radians(angle);front=abs(angle)<90
    left,right=m['neckTop'];bottom_left,bottom_right=m['neckBottom'];y=m['neckY']
    depth=42 if front else 26 if abs(angle)==90 else -12
    thickness=72 if n==9 else 40
    color={4:'#292929',9:'#58BF43',11:'#383838'}[n]
    band=path(f'M{left-5} {y-5} C{left+70} {y+depth} {right-70} {y+depth} {right+5} {y-5} L{bottom_right+4} {y+thickness} C{right-80} {y+depth+thickness} {left+80} {y+depth+thickness} {bottom_left-4} {y+thickness}Z',color)
    result=[band]
    if n==4:
        for i in range(7):
            x=left+25+(right-left-50)*i/6
            result.append(ellipse(x,y+25+depth*.6,4,5,'#D8D8D8',width=2))
    if n==9:
        k=(left+right)/2-110*math.cos(a)+65*math.sin(a)
        if abs(angle)<=90 or angle<0:
            result.insert(0,path(f'M{k-19} {y+28} C{k-29} {y+72} {k-26} {y+112} {k-31} {y+160} L{k+31} {y+168} C{k+24} {y+92} {k+29} {y+63} {k+15} {y+28}Z',color))
            for dx in (-20,-5,10,25):result.append(path(f'M{k+dx} {y+152} L{k+dx-2} {y+172}','none',INK,3))
            result.append(path(f'M{k-12} {y+44} L{k-15} {y+141}','none','#329A30',4))
        result.append(path(f'M{left+12} {y+12} C{left+85} {y+depth+14} {right-85} {y+depth+14} {right-12} {y+12}','none','#87D66B',4))
    if n==11:
        k=(left+right)/2+math.sin(a)*145
        if abs(angle)<135:
            result.extend([path(f'M{k-26} {y+46} L{k-41} {y+159} L{k} {y+134} L{k+27} {y+169} L{k+31} {y+44}Z',color),ellipse(k,y+53,21,20,'#D8D8D8'),ellipse(k-8,y+52,4,6,INK,width=0),ellipse(k+8,y+52,4,6,INK,width=0),path(f'M{k-9} {y+67} L{k-9} {y+77} L{k+9} {y+77} L{k+9} {y+67}','#D8D8D8')])
    return result


def glasses(n,angle,view,m):
    eyes=[p for p in view['parts'] if p['role']=='eye'];a=math.radians(angle)
    if not eyes:
        return [],False
    positions=[(p['pivot'][0]-view['ground'][0],p['pivot'][1]-view['ground'][1]) for p in eyes]
    result=[];face_edge=m['head'][0] if angle<0 else m['head'][1]
    for x,y in positions:
        if n==8:
            rx=35 if len(eyes)==2 else 25
            result.append(path(f'M{x} {y+24} C{x-rx*2} {y-13} {x-rx} {y-44} {x} {y-18} C{x+rx} {y-44} {x+rx*2} {y-13} {x} {y+24}Z','#3D3939','#AF6734',6))
        elif n==12:
            for i in range(5):
                dx=(i-2)*14
                result.append(path(f'M{x+dx} {y+13} C{x+dx-25} {y-10} {x+dx-20} {y-50-abs(dx)*.3} {x+dx} {y-31} C{x+dx+18} {y-44} {x+dx+24} {y-8} {x+dx} {y+13}Z',INK,width=3))
            result.append(ellipse(x,y,24,15,'#FFD525',width=4))
        else:
            result.append(ellipse(x,y,38 if len(eyes)==2 else 26,29,'#3D3939','#AF6734',7))
            result.append(path(f'M{x-10} {y-15} L{x-17} {y+6}','none','#888A8C',4))
    if len(positions)==2:
        x1,y1=positions[0];x2,y2=positions[1]
        result.insert(0,path(f'M{x1} {y1} C{(x1+x2)/2} {min(y1,y2)-8} {(x1+x2)/2} {min(y1,y2)-8} {x2} {y2}','none','#AF6734',6))
    else:
        x,y=positions[0];ear=(sum(m['head'])/2)+(-30 if angle>0 else 30)
        result.insert(0,path(f'M{x} {y-6} L{ear} {y-20}','none',INK,6))
    return result,True


def shoe(n,angle,foot,view):
    side=foot['side'];cx=foot['pivot'][0]-view['ground'][0];y=-5
    profile=abs(angle)==90;back=abs(angle)>90
    colors={1:'#D94C4C',2:'#467FB3',5:'#F4D44B',6:'#4694DA',7:'#EF8DB7',8:'#E6C64C',9:'#D94C4C',10:'#EF8DB7',11:'#58AF62',12:'#58AF62'}
    sneaker=n in (1,5,6,7,11);width=187 if profile else 158
    left=cx-width/2;right=cx+width/2;top=-58 if sneaker else -41
    result=[path(f'M{left} {y-10} C{left-8} {top+16} {left+35} {top-6} {cx} {top} C{right-35} {top-6} {right+8} {top+16} {right} {y-10} L{right-5} {y} L{left+5} {y}Z',colors[n]),path(f'M{left+1} {y-13} C{cx-30} {y-7} {cx+30} {y-7} {right-1} {y-13} L{right-5} {y} L{left+5} {y}Z','#E5E5E5')]
    if not back:
        if sneaker:
            for dy in (0,9,18):result.append(path(f'M{cx-19} {top+8+dy} L{cx+19} {top+8+dy}','none','#F5F0E4',4))
        else:result.append(path(f'M{cx-35} {top+15} C{cx-15} {top+24} {cx+15} {top+24} {cx+35} {top+15}','none',INK,4))
    else:result.append(path(f'M{cx} {top+8} L{cx} {y-14}','none',INK,3))
    return result


def build_frames(views,wardrobe,out,write_svg,root):
    (out/'frames').mkdir(exist_ok=True)
    measurements=json.loads(subprocess.check_output(['node',str(root/'scripts/measure-pixi-duck.mjs')],input=json.dumps(views).encode(),cwd=root))
    front=next(v for v in views if v['angle']==0)
    for view in views:
        m=measurements[str(view['angle'])];view['attachments']={**m,'eyes':[p['pivot'] for p in view['parts'] if p['role']=='eye']}
        for part in view['parts']:
            # Keep the animated hinge inside the shoulder.
            if part['role']=='wing':part['pivot'][0]-=part['side']*35
    for entry in wardrobe:
        slot,n=entry['slot'],entry['sourceNumber'];entry['frames']={}
        for view in views:
            angle=view['angle'];m=measurements[str(angle)];defs=[];visible=True;layer='clothes';attachment='body';elements=[];grip=None
            if slot=='cap':elements,defs=headgear(n,angle,m,entry['parts'][0],out);attachment='head'
            elif slot=='shades':elements,visible=glasses(n,angle,view,m);attachment='eyes'
            elif slot=='acc' and n in (4,9,11):elements=neckwear(n,angle,m);attachment='neck'
            elif slot=='shoes':
                feet=[p for p in view['parts'] if p['role']=='foot'];frames=[]
                for foot in feet:
                    art=shoe(n,angle,foot,view);shoe_defs=[]
                    if abs(angle)<90:
                        part=next(part for part in entry['parts'] if part['side']==foot['side'])
                        original,shoe_defs=source(part,out);x,y,w,h=part['rect'];scale=(182 if n in (1,5,6,7,11) else 167)/w
                        cx=foot['pivot'][0]-view['ground'][0]
                        art=[group(original,f'translate({cx} -3) scale({scale}) translate({-x-w/2} {-y-h})')]
                    spec=write_svg(f'frames/{entry["id"]}-{angle}-{foot["side"]}.svg',art,shoe_defs);spec.update({'attachment':'foot','side':foot['side'],'anchor':[foot['pivot'][i]-view['ground'][i] for i in range(2)],'layer':'feet','visible':True});frames.append(spec)
                entry['frames'][str(angle)]=frames;continue
            else:
                part=entry['parts'][0];art,defs=source(part,out);a=math.radians(angle)
                if n in (5,10,12):
                    sx=1 if abs(angle) in (0,180) else .85 if abs(angle)==45 else .7 if abs(angle)==135 else .65
                    dx=math.sin(a)*100
                    elements=[group(art,f'translate({dx} 0) scale({sx} 1) translate({-360/.88} {-776/.88-10.5}) scale({1/.88})')]
                    if abs(angle)>90 and n in (5,10):elements=[path('M-161 -393 L153 -130 L164 -145 L-151 -407Z','#784626')]
                    if abs(angle)>90 and n==12:
                        elements=[path('M-110 -405 L145 -190','none','#784626',16),path('M80 -340 L155 -100 L190 -112 L115 -353Z','#3D3939'),path('M75 -354 L48 -420 L66 -428 L93 -359Z','#6B6B6B'),path('M48 -345 L123 -373','none',INK,13)]
                else:
                    sx=math.cos(a)
                    if abs(sx)<.6:sx=.6 if abs(angle)<=90 else -.6
                    dx=math.sin(a)*65
                    if abs(angle)>90:
                        layer='behind'
                        if n==8:
                            elements=[group([path('M-292 -365 C-326 -358 -334 -331 -321 -300 L-209 16 C-192 62 -132 41 -142 2 L-251 -329 C-261 -359 -271 -373 -292 -365Z','#484848'),path('M-283 -340 L-165 8','none','#696969',4)],f'translate({dx} 0) scale({sx} 1)')]
                        else:elements=[group(art,f'translate({dx} 0) scale({sx} 1) translate({-360/.88} {-776/.88-10.5}) scale({1/.88})')]
                    else:elements=[group(art,f'translate({dx} 0) scale({sx} 1) translate({-360/.88} {-776/.88-10.5}) scale({1/.88})')]
                if abs(angle)==90 and n==10:
                    s=1 if angle>0 else -1
                    elements=[group([path('M-125 -400 C-60 -320 65 -270 150 -195','none',INK,15),path('M105 -225 C130 -247 185 -237 197 -214 L188 -149 C167 -128 118 -141 103 -163Z','#3D3939'),path('M111 -200 L193 -183','none','#A8A8A8',4)],f'scale({s} 1)')]
                if abs(angle)==90 and n==12:
                    s=1 if angle>0 else -1
                    elements=[group([path('M-149 -385 L-196 -69 L-167 -57 L-117 -375Z','#3D3939'),path('M-143 -408 L-131 -492 L-111 -489 L-123 -403Z','#6B6B6B'),path('M-169 -397 L-95 -385','none',INK,13),path('M-111 -359 C-15 -316 62 -260 156 -207','none','#784626',14)],f'scale({s} 1)')]
                if layer!='behind':layer='held'
                attachment='wing'
                if abs(angle)<=90 and n in (5,8,6):
                    gx,gy={5:(170,-190),8:(-215,-110),6:(215,-120)}[n]
                    grip=[ellipse(gx*(.75 if abs(angle)==90 else 1)+math.sin(a)*45,gy,20,29,'#FFD525',width=4)]
            if not elements:elements=[path('M0 0 L0 1','none',width=0)]
            anchor=[0,-450] if attachment in ('head','eyes') else [0,0]
            wing_side=0
            if attachment=='wing':
                if n in (6,8) and layer!='behind':
                    wings=[part for part in view['parts'] if part['role']=='wing']
                    wing=min(wings,key=lambda part:abs(part['side']-(-1 if n==8 else 1)))
                    wing_side=wing['side'];anchor=[wing['pivot'][i]-view['ground'][i] for i in range(2)]
                else:attachment='body'
            frame=write_svg(f'frames/{entry["id"]}-{angle}.svg',elements,defs);frame.update({'attachment':attachment,'layer':layer,'visible':visible,'anchor':anchor,'wingSide':wing_side})
            entry['frames'][str(angle)]=[frame]
            if grip:
                spec=write_svg(f'frames/{entry["id"]}-{angle}-grip.svg',grip);spec.update({'attachment':attachment if n!=5 else 'grip','layer':'clothes','visible':True,'anchor':anchor,'wingSide':wing_side});entry['frames'][str(angle)].append(spec)
