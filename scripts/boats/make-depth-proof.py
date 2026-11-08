from PIL import Image,ImageDraw
from pathlib import Path
import json, os
p=Path(__file__).resolve().parents[3]/'concepts/boat-turntable'
name=os.environ.get('BOAT_PROOF','depth')
ims=[Image.open(p/f'spin48-work/{name}/frame-{n:02d}.png').convert('RGB') for n in range(48)]
sheet=Image.new('RGB',(8*300,6*295),'#c4e2f5');gif=[]
for n,im in enumerate(ims):
 thumb=im.resize((300,275),Image.Resampling.LANCZOS);x=n%8*300;y=n//8*295
 sheet.paste(thumb,(x,y+20));ImageDraw.Draw(sheet).text((x+8,y+4),f'{n:02d}  {90-n*7.5:g} deg',fill='#263e45')
 frame=im.copy();ImageDraw.Draw(frame).text((12,12),f'View {n:02d} / 48, pinned rider',fill='#263e45');gif.append(frame)
sheet.save(p/f'spin48-{name}.png');gif[0].save(p/f'spin48-{name}.gif',save_all=True,append_images=gif[1:],duration=110,loop=0,optimize=False)
if name=='mast':
 turns=[Image.open(f).convert('RGB') for f in sorted((p/f'spin48-work/{name}').glob('turn-*.png'))]
 if turns:
  turns[0].save(p/'spin48-mast.gif',save_all=True,append_images=turns[1:],duration=33,loop=0,optimize=False)
r=json.loads((p/f'spin48-work/{name}/runtime.json').read_text());assert len(r['proof'])==48
assert {tuple(f['pin']) for f in r['proof']}=={(240,305)}
assert {tuple(f['z']) for f in r['proof']}=={(357,369,371)}
assert all(f['mask'] is None for f in r['proof']);print('48 frames; pin (240,305), z 357/369/371, no generic seat mask')
