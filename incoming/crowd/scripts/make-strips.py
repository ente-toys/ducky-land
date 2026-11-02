from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'evidence'
font=ImageFont.truetype(str(ROOT/'rive/fonts/Gilroy-Black.ttf'),22)
strip=Image.new('RGB',(1600,1596),'#FFF4C5')
d=ImageDraw.Draw(strip)
for i,t in enumerate([0,5,8,12,16,20]):
    im=Image.open(out/f'runtime-{t:02d}s.png').convert('RGB').resize((800,500))
    x=(i%2)*800;y=(i//2)*532
    strip.paste(im,(x,y));d.text((x+16,y+502),f'{t:02d}s',fill='#232323',font=font)
strip.save(out/'crowd-20s-frame-strip.jpg',quality=94)
poses=Image.new('RGB',(1425,760),'#FFF4C5')
p=ImageDraw.Draw(poses)
for i,name in enumerate(['sit','wave','look','preen','sleep']):
    im=Image.open(out/f'{name}-runtime.png').convert('RGB').crop((40,220,705,870)).resize((285,279))
    x=i*285;poses.paste(im,(x,55));p.text((x+20,18),name.capitalize(),fill='#232323',font=font)
poses.crop((0,0,1425,350)).save(out/'native-poses.jpg',quality=95)
print('Saved 0..20 second strip and native pose sheet.')
