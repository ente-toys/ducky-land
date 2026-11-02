#!/usr/bin/env python3
"""Build both unsigned native Rive variants, checking the resolved scenes."""
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent
RIVE = ROOT / 'rive'
QA = ROOT / 'qa'
QA.mkdir(exist_ok=True)

def run(*args, output=None):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=True)
    if output:
        (QA / output).write_text(result.stdout)
    else:
        print(result.stdout, end='')
    if result.stderr:
        print(result.stderr, end='')

run('python3', str(RIVE / 'plaza.py'))
run('rive', str(RIVE), '--verify', '--format=json', output='rive-verify.json')
run('rive', 'inspect', str(RIVE), '--summary', output='rive-inspect.json')
run('rive', str(RIVE), '--once')
shutil.copyfile(RIVE / 'build/ducky-land.riv', RIVE / 'web/ducky-land.riv')
lite = ROOT / 'rive-lite'
lite.mkdir(exist_ok=True)
(lite / 'rive.yaml').write_text('name: ducky-land-lite\nmain: Plaza\n')
(lite / 'scene.rml').write_text((RIVE / 'scene.rml').read_text())
plaza = (RIVE / 'plaza.rml').read_text()
plaza, count = re.subn(r'<NestedArtboard\b[^>]*name="Slot (?:[6-9]|1[0-5])"[^>]*>.*?</NestedArtboard>', '', plaza, flags=re.S)
assert count == 10, f'Expected to remove 10 native placements, removed {count}'
(lite / 'plaza.rml').write_text(plaza)
shutil.copytree(RIVE / 'fonts', lite / 'fonts', dirs_exist_ok=True)
run('rive', str(lite), '--verify', '--format=json', output='rive-lite-verify.json')
run('rive', 'inspect', str(lite), '--summary', output='rive-lite-inspect.json')
run('rive', str(lite), '--once')
shutil.copyfile(lite / 'build/ducky-land-lite.riv', RIVE / 'web/ducky-land-lite.riv')
print('Native variants: 16 placements / 6 placements. No scripts or signed builds.')
