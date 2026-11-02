from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / 'rive'
TARGET = ROOT / 'rive'
TARGET.mkdir(exist_ok=True)
for name in ['gen.py', 'plaza.py', 'drip_style.py', 'rive.yaml']:
    shutil.copy2(SOURCE / name, TARGET / name)
for name in ['fonts', 'web']:
    shutil.copytree(SOURCE / name, TARGET / name, dirs_exist_ok=True)
shutil.copytree(ROOT.parent / 'drip-ref' / 'svg', ROOT / 'drip-ref' / 'svg', dirs_exist_ok=True)
(ROOT / 'shots').mkdir(exist_ok=True)
(ROOT / 'incoming').mkdir(exist_ok=True)
print('Copied the canonical Ducky rig, style kit, fonts, runtime and source SVGs.')
